-- Run in connection A, then run leave_concurrency_contender.sql within 20 seconds.
-- yumyum_leave_race_holder
begin;
set local statement_timeout='45s';
do $$
declare u uuid; w date; d date := public.study_date(clock_timestamp()); g uuid; n integer; p jsonb;
begin
 select p.id into u from public.profiles p join auth.users a on a.id=p.id where a.raw_user_meta_data ? 'study_core_test' and p.room_id=1 order by p.created_at desc limit 1;
 if u is null then raise exception 'Test profile required'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 w:=d-(extract(isodow from d)::integer-1);
 insert into public.leave_grants(user_id,earning_week,earned_at,expires_at)
 values(u,w,(w+time '06:00') at time zone 'Asia/Seoul',((w+21)+time '06:00') at time zone 'Asia/Seoul')
 on conflict(user_id,earning_week,kind) do update set scheduled_date=null returning id into g;
 p:=public.get_leave_status(); n:=(p->'data'->>'availableCount')::integer;
 p:=public.schedule_leave(g,d+1);
 if (p->'data'->>'availableCount')::integer<>n-1 then raise exception 'Reservation balance failed'; end if;
 perform pg_sleep(20);
 p:=public.cancel_leave(g,d+1);
 if (p->'data'->>'availableCount')::integer<>n then raise exception 'Cancellation balance failed'; end if;
end; $$;
rollback;
select 'holder: reservation and cancellation passed; all changes rolled back' as result;
