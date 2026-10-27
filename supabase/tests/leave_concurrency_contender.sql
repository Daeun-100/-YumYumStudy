-- Run in independent connection B while A is sleeping. No persistent changes.
-- An arbitrary grant ID is sufficient: the shared profile lock must be acquired
-- before any grant lookup. This verifies cross-connection serialization, not a load benchmark.
begin;
set local statement_timeout='40s';
set local lock_timeout='750ms';
do $$
declare u uuid; d date := public.study_date(clock_timestamp()); blocked integer := 0; g uuid := 'd2781071-9e16-4d35-b7d1-f7eaade918b2';
begin
 select p.id into u from public.profiles p join auth.users a on a.id=p.id where a.raw_user_meta_data ? 'study_core_test' and p.room_id=1 order by p.created_at desc limit 1;
 if u is null then raise exception 'Test profile required'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 if not exists(select 1 from pg_stat_activity where pid<>pg_backend_pid() and state='active' and wait_event='PgSleep' and query like '%yumyum_leave_race_holder%') then raise exception 'Start holder connection first'; end if;
 begin perform public.schedule_leave(g,d+1); exception when lock_not_available then blocked:=blocked+1; end;
 begin perform public.cancel_leave(g,d+1); exception when lock_not_available then blocked:=blocked+1; end;
 begin perform public.get_leave_status(); exception when lock_not_available then blocked:=blocked+1; end;
 if blocked<>3 then raise exception 'Expected three blocked operations, got %',blocked; end if;
 perform set_config('lock_timeout','30s',true);
 perform public.get_leave_status();
end; $$;
rollback;
select 'contender: schedule, cancel and status blocked on same profile; retry succeeded after release' as result;
