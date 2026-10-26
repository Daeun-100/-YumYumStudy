-- Apply 280 first. All fixtures and requests roll back.
begin;
do $$
declare u uuid; w date; d date:=public.study_date(clock_timestamp()); a uuid; b uuid;
begin
 select p.id into u from public.profiles p join auth.users x on x.id=p.id
 where x.raw_user_meta_data ? 'study_core_test' and p.room_id=1 order by p.created_at desc limit 1;
 if u is null then raise exception 'Test profile required'; end if;
 -- Legacy test fixtures predate admission. This fixture-only update rolls back.
 update public.profiles set invite_verified_at=coalesce(invite_verified_at,clock_timestamp()), name_confirmed=true where id=u;
 perform set_config('request.jwt.claim.sub',u::text,true);
 w:=d-(extract(isodow from d)::integer-1);
 insert into public.leave_grants(user_id,earning_week,earned_at,expires_at)
 values(u,w-7,((w-7)+time '06:00') at time zone 'Asia/Seoul',((w+14)+time '06:00') at time zone 'Asia/Seoul')
 on conflict(user_id,earning_week) do update set scheduled_date=null returning id into a;
 insert into public.leave_grants(user_id,earning_week,earned_at,expires_at)
 values(u,w,(w+time '06:00') at time zone 'Asia/Seoul',((w+21)+time '06:00') at time zone 'Asia/Seoul')
 on conflict(user_id,earning_week) do update set scheduled_date=null returning id into b;
 perform set_config('test.a',a::text,true); perform set_config('test.b',b::text,true);
 perform set_config('test.date',(d+1)::text,true);
end; $$;
set local role authenticated;
do $$
declare a uuid:=current_setting('test.a')::uuid; b uuid:=current_setting('test.b')::uuid;
 d date:=current_setting('test.date')::date; p jsonb; rev bigint; move_id uuid:=gen_random_uuid();
begin
 p:=public.get_leave_status(); rev:=(p->'data'->>'revision')::bigint;
 perform public.mutate_leave(gen_random_uuid(),rev,'schedule',d,a);
 p:=public.mutate_leave(move_id,rev+1,'schedule',d+1,a);
 if (p->'data'->>'revision')::bigint<>rev+2 or not exists(select 1 from public.leave_grants where id=a and scheduled_date=d+1) then raise exception 'Move failed'; end if;
 perform public.mutate_leave(move_id,rev+1,'schedule',d+1,a);
 perform public.mutate_leave(gen_random_uuid(),rev+2,'schedule',d+2,b);
 begin perform public.mutate_leave(gen_random_uuid(),rev+3,'schedule',d+2,a); raise exception 'Occupied date accepted'; exception when sqlstate '22023' then null; end;
 begin perform public.mutate_leave(gen_random_uuid(),rev+3,'schedule',d-1,a); raise exception 'Today accepted'; exception when sqlstate '22023' then null; end;
 begin perform public.mutate_leave(gen_random_uuid(),rev+3,'schedule',d+30,a); raise exception 'Expiry accepted'; exception when sqlstate '22023' then null; end;
 begin perform public.mutate_leave(gen_random_uuid(),rev,'schedule',d+3,a); raise exception 'Stale revision accepted'; exception when sqlstate '22023' then null; end;
 if not exists(select 1 from public.leave_grants where id=a and scheduled_date=d+1) then raise exception 'Failed move lost original booking'; end if;
 if has_function_privilege('authenticated','public.schedule_leave(uuid,date)','execute') then raise exception 'Legacy bypass'; end if;
end; $$;
reset role;
rollback;
select 'atomic date move, replay, stale revision, expiry and occupied-date rollback passed' as result;
