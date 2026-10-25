-- Run as the project owner in SQL Editor AFTER the integration test.
-- Synthetic sessions and goal versions are rolled back; real user rows are untouched.
begin;
do $$
declare
  v_uid uuid;
  v_before1 bigint;
  v_before2 bigint;
  v_day jsonb;
begin
  select p.id into v_uid from public.profiles p join auth.users u on u.id = p.id
    where u.raw_user_meta_data ? 'study_core_test'
      and not exists(select 1 from public.study_sessions s where s.user_id = p.id and s.ended_at is null)
    order by p.created_at desc limit 1;
  if v_uid is null then raise exception 'Run check-study-core.mjs first; a test profile is required'; end if;

  if public.study_date('2026-10-26 05:59:59+09') <> date '2026-10-25'
    or public.study_date('2026-10-26 06:00:00+09') <> date '2026-10-26' then
    raise exception '06:00 study date boundary mismatch';
  end if;

  v_before1 := (public._day_record(v_uid, '2020-01-01', '2020-01-05 06:00+09')->>'closedSeconds')::bigint;
  v_before2 := (public._day_record(v_uid, '2020-01-02', '2020-01-05 06:00+09')->>'closedSeconds')::bigint;
  insert into public.study_sessions(user_id, started_at, ended_at)
    values(v_uid, '2020-01-02 05:30+09', '2020-01-02 06:30+09');
  if (public._day_record(v_uid, '2020-01-01', '2020-01-05 06:00+09')->>'closedSeconds')::bigint - v_before1 <> 1800
    or (public._day_record(v_uid, '2020-01-02', '2020-01-05 06:00+09')->>'closedSeconds')::bigint - v_before2 <> 1800 then
    raise exception 'Closed session split mismatch';
  end if;

  insert into public.study_sessions(user_id, started_at)
    values(v_uid, '2020-01-03 05:30+09');
  v_day := public._day_record(v_uid, '2020-01-03', '2020-01-04 06:30+09');
  if (v_day->>'runningSeconds')::bigint <> 86400 then raise exception 'Full running day mismatch'; end if;
  if (public._day_record(v_uid, '2020-01-04', '2020-01-04 06:30+09')->>'runningSeconds')::bigint <> 1800 then
    raise exception 'Current running day mismatch';
  end if;
  if (public._day_record(v_uid, '2020-01-05', '2020-01-04 06:30+09')->>'runningSeconds')::bigint <> 0 then
    raise exception 'Future running day must be zero';
  end if;
  if v_day->>'attendance' <> 'present' or v_day->'goalMinutes' <> 'null'::jsonb then
    raise exception 'Running time must count toward attendance without a goal';
  end if;

  insert into public.goal_versions(user_id, effective_date, weekday_minutes)
    values(v_uid, '2020-01-02', array[10,20,30,40,50,60,70]),
      (v_uid, '2020-01-04', array[100,200,300,400,500,600,700]);
  if (public._day_record(v_uid, '2020-01-02', '2020-01-05 06:00+09')->>'goalMinutes')::integer <> 40
    or (public._day_record(v_uid, '2020-01-04', '2020-01-05 06:00+09')->>'goalMinutes')::integer <> 600 then
    raise exception 'Goal version or Monday-first weekday mismatch';
  end if;
end;
$$;
rollback;
select 'PASS: 06:00 boundary, closed/running split, multi-day totals, goal history; fixtures rolled back' as result;
