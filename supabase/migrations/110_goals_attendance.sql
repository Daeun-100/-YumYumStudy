begin;

alter table public.goal_versions add constraint goal_minutes_at_most_one_day
  check (1440 >= all(weekday_minutes));

create function public.save_goals(p_weekday_minutes integer[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_now timestamptz; v_effective date;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_weekday_minutes is null or cardinality(p_weekday_minutes) <> 7
    or array_ndims(p_weekday_minutes) <> 1 or array_lower(p_weekday_minutes, 1) <> 1
    or exists(select 1 from unnest(p_weekday_minutes) n where n < 0 or n > 1440) then
    raise exception 'Seven goals between 0 and 1440 minutes or null required' using errcode = '22023';
  end if;
  perform 1 from public.profiles where id = v_uid and room_id = 1 for update;
  if not found then raise exception 'Profile required' using errcode = '42501'; end if;
  -- Evaluate after acquiring the lock so a queued request crossing 06:00 uses the new day.
  v_now := clock_timestamp();
  v_effective := public.study_date(v_now) + 1;
  insert into public.goal_versions(user_id, effective_date, weekday_minutes)
    values(v_uid, v_effective, p_weekday_minutes)
    on conflict (user_id, effective_date) do update set weekday_minutes = excluded.weekday_minutes;
  return jsonb_build_object('serverNow', v_now, 'data', jsonb_build_object(
    'effectiveDate', v_effective, 'goals', to_jsonb(p_weekday_minutes)));
end;
$$;

create function public.get_goal_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_now timestamptz := statement_timestamp();
  v_date date; v_current jsonb; v_scheduled jsonb;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  v_date := public.study_date(v_now);
  select to_jsonb(weekday_minutes) into v_current from public.goal_versions
    where user_id = v_uid and effective_date <= v_date order by effective_date desc limit 1;
  select to_jsonb(weekday_minutes) into v_scheduled from public.goal_versions
    where user_id = v_uid and effective_date = v_date + 1;
  return jsonb_build_object('serverNow', v_now, 'data', jsonb_build_object(
    'current', coalesce(v_current, '[null,null,null,null,null,null,null]'::jsonb),
    'scheduled', v_scheduled, 'effectiveDate', case when v_scheduled is null then null else v_date + 1 end));
end;
$$;

create or replace function public._day_record(p_uid uuid, p_date date, p_now timestamptz) returns jsonb
language sql stable set search_path = '' as $$
  with bounds as (
    select (p_date + time '06:00') at time zone 'Asia/Seoul' as lo,
      ((p_date + 1) + time '06:00') at time zone 'Asia/Seoul' as hi
  ), totals as (
    select coalesce(sum(greatest(0, floor(extract(epoch from
      least(s.ended_at, b.hi, p_now) - greatest(s.started_at, b.lo))))) filter (where s.ended_at is not null), 0) as closed,
      coalesce(sum(greatest(0, floor(extract(epoch from
      least(p_now, b.hi) - greatest(s.started_at, b.lo))))) filter (where s.ended_at is null), 0) as running
    from bounds b left join public.study_sessions s on s.user_id = p_uid
      and s.started_at < b.hi and coalesce(s.ended_at, p_now) > b.lo
  ), goal as (
    select (select g.weekday_minutes[extract(isodow from p_date)::integer]
      from public.goal_versions g where g.user_id = p_uid and g.effective_date <= p_date
      order by g.effective_date desc limit 1) as minutes
  )
  select jsonb_build_object('studyDate', p_date, 'closedSeconds', t.closed,
    'runningSeconds', t.running, 'goalMinutes', g.minutes,
    'attendance', case when t.closed + t.running >= 1 then 'present'
      when p_now >= b.hi then 'absent' else 'pending' end,
    'isRestDay', coalesce(g.minutes = 0, false),
    'goalAchieved', case when g.minutes > 0 then t.closed + t.running >= g.minutes * 60 else null end)
  from totals t cross join bounds b cross join goal g;
$$;

revoke all on function public.save_goals(integer[]), public.get_goal_settings() from public, anon, authenticated;
grant execute on function public.save_goals(integer[]), public.get_goal_settings() to authenticated;
commit;
