-- Owner-run SQL checks. All changes, including scheduled goals, are rolled back.
begin;
do $$
declare v_uid uuid; v_before jsonb; v_saved jsonb; v_settings jsonb; v_date date; v_day jsonb; v_count integer;
begin
  select p.id into v_uid from public.profiles p join auth.users u on u.id = p.id
    where u.raw_user_meta_data ? 'study_core_test'
    and not exists(select 1 from public.study_sessions s where s.user_id = p.id and s.ended_at is null)
    order by p.created_at desc limit 1;
  if v_uid is null then raise exception 'A completed integration-test profile is required'; end if;
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  if has_function_privilege('anon', 'public.save_goals(integer[])', 'EXECUTE') then
    raise exception 'Unauthenticated writes must not be granted';
  end if;
  v_before := public.get_goals();
  v_day := public._day_record(v_uid, '2019-12-28', '2019-12-28 12:00+09');
  if (v_day->>'closedSeconds')::bigint <> 0 or (v_day->>'runningSeconds')::bigint <> 0
    or v_day->>'attendance' <> 'pending' then raise exception 'Empty day must have zero study time'; end if;
  v_saved := public.save_goals(array[0,60,120,null,1440,30,0]);
  v_date := public.study_date((v_saved->>'serverNow')::timestamptz);
  if (v_saved->'data'->>'effectiveDate')::date <> v_date + 1 then raise exception 'Next study date required'; end if;
  if public.get_goals() <> v_before then raise exception 'Current goals changed too early'; end if;
  v_settings := public.get_goal_settings()->'data';
  if v_settings->'scheduled' <> '[0,60,120,null,1440,30,0]'::jsonb then raise exception 'Scheduled goals missing'; end if;
  perform public.save_goals(array[30,30,0,null,1440,60,0]);
  select count(*) into v_count from public.goal_versions where user_id = v_uid and effective_date = v_date + 1;
  if v_count <> 1 then raise exception 'Repeated save created duplicate versions'; end if;
  if public.get_goals() <> v_before then raise exception 'Repeated save changed current goals'; end if;
  begin
    perform public.save_goals(array[1441,0,0,0,0,0,0]);
    raise exception 'Invalid goal was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_goals(array[60]);
    raise exception 'Invalid week length was accepted';
  exception when sqlstate '22023' then null;
  end;

  insert into public.goal_versions(user_id, effective_date, weekday_minutes)
    values(v_uid, '2019-12-30', array[120,120,120,120,120,120,120]),
      (v_uid, '2019-12-31', array[0,0,0,0,0,0,0]);
  insert into public.study_sessions(user_id, started_at, ended_at)
    values(v_uid, '2019-12-30 06:00:00+09', '2019-12-30 06:00:00.999+09');
  v_day := public._day_record(v_uid, '2019-12-30', '2019-12-30 07:00+09');
  if v_day->>'attendance' <> 'pending' then raise exception 'Less than one recorded second must not count'; end if;
  insert into public.study_sessions(user_id, started_at, ended_at)
    values(v_uid, '2019-12-30 06:01:00+09', '2019-12-30 06:01:01+09');
  v_day := public._day_record(v_uid, '2019-12-30', '2019-12-30 07:00+09');
  if v_day->>'attendance' <> 'present' or v_day->'goalAchieved' <> 'false'::jsonb then
    raise exception 'One second must count independently of goal completion';
  end if;

  insert into public.study_sessions(user_id, started_at) values(v_uid, '2019-12-31 06:00+09');
  v_day := public._day_record(v_uid, '2019-12-31', '2019-12-31 06:00:00.999+09');
  if v_day->>'attendance' <> 'pending' then raise exception 'Running subsecond must not count'; end if;
  v_day := public._day_record(v_uid, '2019-12-31', '2019-12-31 06:00:01+09');
  if v_day->>'attendance' <> 'present' or v_day->'isRestDay' <> 'true'::jsonb or v_day->'goalAchieved' <> 'null'::jsonb then
    raise exception 'Running rest-day attendance must remain separate';
  end if;
  v_day := public._day_record(v_uid, '2019-12-29', '2019-12-30 05:59:59+09');
  if v_day->>'attendance' <> 'pending' or v_day->'isRestDay' <> 'false'::jsonb then raise exception 'Unset is not rest'; end if;
  v_day := public._day_record(v_uid, '2019-12-29', '2019-12-30 06:00+09');
  if v_day->>'attendance' <> 'absent' then raise exception 'No-study day ends at exactly 06:00'; end if;
  v_day := public._day_record(v_uid, '2020-01-02', '2020-01-01 12:00+09');
  if v_day->>'attendance' <> 'pending' then raise exception 'Future dates must remain pending'; end if;
end;
$$;
rollback;
select 'PASS: next-day goals, repeated save, 0/1440 limits, one-second attendance, rest-day separation, 06:00 boundary; rolled back' as result;
