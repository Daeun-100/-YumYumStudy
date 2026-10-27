begin;
do $$
declare u uuid; w date; d date:=public.study_date(clock_timestamp()); a uuid; b uuid;
begin
 select p.id into u from public.profiles p join auth.users x on x.id=p.id where x.raw_user_meta_data ? 'study_core_test' and p.room_id=1 order by p.created_at desc limit 1;
 if u is null then raise exception 'Test profile required'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 w:=d-(extract(isodow from d)::integer-1);
 insert into public.leave_grants(user_id,earning_week,earned_at,expires_at) values(u,w-7,((w-7)+time '06:00') at time zone 'Asia/Seoul',((w+14)+time '06:00') at time zone 'Asia/Seoul') on conflict(user_id,earning_week) do update set scheduled_date=null returning id into a;
 insert into public.leave_grants(user_id,earning_week,earned_at,expires_at) values(u,w,(w+time '06:00') at time zone 'Asia/Seoul',((w+21)+time '06:00') at time zone 'Asia/Seoul') on conflict(user_id,earning_week) do update set scheduled_date=null returning id into b;
 perform set_config('test.a',a::text,true); perform set_config('test.b',b::text,true);
 perform set_config('test.date',(d+1)::text,true); perform set_config('test.later',(w+14)::text,true);
end; $$;
set local role authenticated;
do $$
declare a uuid:=current_setting('test.a')::uuid; b uuid:=current_setting('test.b')::uuid; d date:=current_setting('test.date')::date;
 r1 uuid:=gen_random_uuid(); r2 uuid:=gen_random_uuid(); p jsonb; rev bigint;
begin
 p:=public.get_leave_status(); rev:=(p->'data'->>'revision')::bigint;
 p:=public.mutate_leave(r1,rev,'schedule',d);
 if (p->'data'->>'revision')::bigint<>rev+1 or not exists(select 1 from public.leave_grants where id=a and scheduled_date=d) then raise exception 'Earliest expiry selection failed'; end if;
 perform public.mutate_leave(r1,rev,'schedule',d);
 perform public.mutate_leave(r2,rev+1,'cancel',d,a);
 perform public.mutate_leave(r1,rev,'schedule',d);
 if exists(select 1 from public.leave_grants where id=a and scheduled_date is not null) then raise exception 'Old schedule replay resurrected booking'; end if;
 begin perform public.mutate_leave(gen_random_uuid(),rev,'schedule',d); raise exception 'Stale unseen request accepted'; exception when sqlstate '22023' then null; end;
 perform public.mutate_leave(gen_random_uuid(),rev+2,'schedule',d);
 perform public.mutate_leave(r2,rev+1,'cancel',d,a);
 if not exists(select 1 from public.leave_grants where id=a and scheduled_date=d) then raise exception 'Old cancellation removed new booking'; end if;
 begin perform public.mutate_leave(r1,rev,'schedule',d+1); raise exception 'Reused key changed input'; exception when sqlstate '22023' then null; end;
 perform public.mutate_leave(gen_random_uuid(),rev+3,'cancel',d,a);
 perform public.mutate_leave(gen_random_uuid(),rev+4,'schedule',current_setting('test.later')::date);
 if not exists(select 1 from public.leave_grants where id=b and scheduled_date=current_setting('test.later')::date) then raise exception 'Expiry boundary selection failed'; end if;
 begin perform public.mutate_leave(gen_random_uuid(),rev+5,'schedule',current_setting('test.later')::date+7); raise exception 'No eligible grant accepted'; exception when sqlstate '22023' then null; end;
 if has_function_privilege('authenticated','public.schedule_leave(uuid,date)','execute') or has_function_privilege('authenticated','public.cancel_leave(uuid,date)','execute') or has_function_privilege('anon','public.mutate_leave(uuid,bigint,text,date,uuid)','execute') then raise exception 'Legacy/anonymous bypass'; end if;
 begin perform 1 from public.leave_requests; raise exception 'Request table exposed'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
rollback;
select 'auto selection, retry, stale requests, ABA protection and permissions passed' as result;
