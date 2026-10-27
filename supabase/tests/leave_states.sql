-- Run after migration 210. Pure boundary checks; no persistent data.
begin;
do $$
begin
  if public._leave_state(null,'2026-11-16 06:00+09','2026-11-16 05:59:59+09') <> 'AVAILABLE'
    or public._leave_state(null,'2026-11-16 06:00+09','2026-11-16 06:00+09') <> 'EXPIRED'
    or public._leave_state('2026-11-02','2026-11-16 06:00+09','2026-11-02 05:59:59+09') <> 'SCHEDULED'
    or public._leave_state('2026-11-02','2026-11-16 06:00+09','2026-11-02 06:00+09') <> 'USED'
    or public._leave_state('2026-11-02','2026-11-16 06:00+09','2026-11-17 06:00+09') <> 'USED' then
    raise exception 'Leave state boundary failed';
  end if;
  if has_function_privilege('anon','public.schedule_leave(uuid,date)','execute')
    or has_function_privilege('anon','public.cancel_leave(uuid,date)','execute')
    or has_function_privilege('authenticated','public._leave_state(date,timestamptz,timestamptz)','execute') then
    raise exception 'Leave permissions failed';
  end if;
end;
$$;
rollback;

-- Rollback integration test using an existing explicitly marked test profile.
begin;
do $$
declare u uuid; w date; today date := ((clock_timestamp() at time zone 'Asia/Seoul') - interval '6 hours')::date; g uuid;
begin
 select p.id into u from public.profiles p join auth.users a on a.id=p.id
 where a.raw_user_meta_data ? 'study_core_test' and p.room_id=1
 order by p.created_at desc limit 1;
 if u is null then raise exception 'Existing study_core_test profile required'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 w := today - (extract(isodow from today)::integer-1);
 insert into public.leave_grants(user_id,earning_week,earned_at,expires_at)
 values(u,w,(w+time '06:00') at time zone 'Asia/Seoul',((w+21)+time '06:00') at time zone 'Asia/Seoul')
 on conflict(user_id,earning_week) do update set scheduled_date=null
 returning id into g;
 perform set_config('test.leave_grant',g::text,true);
end;
$$;
set local role authenticated;
do $$
declare g uuid := current_setting('test.leave_grant')::uuid;
 today date := ((clock_timestamp() at time zone 'Asia/Seoul') - interval '6 hours')::date; payload jsonb; before_count integer;
begin
 payload := public.get_leave_status();
 before_count := (payload->'data'->>'availableCount')::integer;
 payload := public.schedule_leave(g,today+1);
 if (payload->'data'->>'availableCount')::integer <> before_count-1
   or not exists(select 1 from jsonb_array_elements(payload->'data'->'grants') x
     where x->>'id'=g::text and x->>'status'='SCHEDULED') then raise exception 'Reservation balance failed'; end if;
 payload := public.schedule_leave(g,today+1);
 if (payload->'data'->>'availableCount')::integer <> before_count-1 then raise exception 'Duplicate reservation charged twice'; end if;
 begin
   perform public.schedule_leave(g,today+2);
   raise exception 'Already booked grant accepted';
 exception when sqlstate '22023' then null; end;
 begin
   perform public.cancel_leave(g,today+2);
   raise exception 'Stale cancellation accepted';
 exception when sqlstate '22023' then null; end;
 payload := public.cancel_leave(g,today+1);
 if (payload->'data'->>'availableCount')::integer <> before_count then raise exception 'Cancellation did not restore balance'; end if;
 payload := public.cancel_leave(g,today+1);
 if (payload->'data'->>'availableCount')::integer <> before_count then raise exception 'Duplicate cancellation changed balance'; end if;
 begin
   perform public.schedule_leave(g,today);
   raise exception 'Today accepted';
 exception when sqlstate '22023' then null; end;
 begin
   perform public.schedule_leave(g,today+30);
   raise exception 'Expired date accepted';
 exception when sqlstate '22023' then null; end;
 begin
   update public.leave_grants set scheduled_date=today+1 where id=g;
   raise exception 'Direct writes accepted';
 exception when insufficient_privilege then null; end;
 if exists(select 1 from public.leave_grants where user_id<>auth.uid()) then raise exception 'RLS leaked grants'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 begin
   perform public.schedule_leave(g,today+1);
   raise exception 'Unauthenticated booking accepted';
 exception when insufficient_privilege then null; end;
end;
$$;
reset role;
rollback;
select 'leave states, reservation, cancellation, balance, boundaries and permissions passed' as result;

begin;
do $$
declare u uuid; other_uid uuid; used_id uuid; expired_id uuid; payload jsonb;
begin
 select p.id into u from public.profiles p join auth.users a on a.id=p.id
 where a.raw_user_meta_data ? 'study_core_test' and p.room_id=1 order by p.created_at desc limit 1;
 select id into other_uid from public.profiles where id<>u and room_id=1 limit 1;
 if u is null or other_uid is null then raise exception 'Test and second profile required'; end if;
 insert into public.leave_grants(user_id,earning_week,earned_at,expires_at,scheduled_date)
 values(u,'2020-03-02','2020-03-07 06:00+09','2020-03-23 06:00+09','2020-03-08')
 on conflict(user_id,earning_week) do update set scheduled_date='2020-03-08'
 returning id into used_id;
 insert into public.leave_grants(user_id,earning_week,earned_at,expires_at)
 values(u,'2020-03-09','2020-03-14 06:00+09','2020-03-30 06:00+09')
 on conflict(user_id,earning_week) do update set scheduled_date=null
 returning id into expired_id;
 perform set_config('request.jwt.claim.sub',u::text,true);
 payload:=public.get_leave_status();
 if not exists(select 1 from jsonb_array_elements(payload->'data'->'grants') x where x->>'id'=used_id::text and x->>'status'='USED')
 or not exists(select 1 from jsonb_array_elements(payload->'data'->'grants') x where x->>'id'=expired_id::text and x->>'status'='EXPIRED') then raise exception 'Terminal states failed'; end if;
 begin perform public.cancel_leave(used_id,'2020-03-08'); raise exception 'Used grant cancelled'; exception when sqlstate '22023' then null; end;
 begin perform public.schedule_leave(expired_id,current_date+1); raise exception 'Expired grant booked'; exception when sqlstate '22023' then null; end;
 perform set_config('request.jwt.claim.sub',other_uid::text,true);
 begin perform public.schedule_leave(used_id,current_date+1); raise exception 'Foreign booking accepted'; exception when sqlstate '22023' then null; end;
 begin perform public.cancel_leave(used_id,'2020-03-08'); raise exception 'Foreign cancellation accepted'; exception when sqlstate '22023' then null; end;
end;
$$;
rollback;
select 'terminal states and foreign ownership checks passed' as result;
