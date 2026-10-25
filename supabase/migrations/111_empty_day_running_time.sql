begin;
-- A LEFT JOIN's empty placeholder is not an active session.
create or replace function public._day_record(p_uid uuid, p_date date, p_now timestamptz) returns jsonb
language sql stable set search_path = '' as $$
  with bounds as (
    select (p_date + time '06:00') at time zone 'Asia/Seoul' as lo,
      ((p_date + 1) + time '06:00') at time zone 'Asia/Seoul' as hi
  ), totals as (
    select coalesce(sum(greatest(0, floor(extract(epoch from
      least(s.ended_at, b.hi, p_now) - greatest(s.started_at, b.lo))))) filter (where s.ended_at is not null), 0) as closed,
      coalesce(sum(greatest(0, floor(extract(epoch from
      least(p_now, b.hi) - greatest(s.started_at, b.lo))))) filter (where s.id is not null and s.ended_at is null), 0) as running
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
commit;
