begin;
-- Fail rather than silently discard existing duplicate reservations.
create unique index leave_grants_one_per_day on public.leave_grants(user_id, scheduled_date)
  where scheduled_date is not null;

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
    'attendance', case when p_now >= b.lo and exists (select 1 from public.leave_grants l
      where l.user_id=p_uid and l.scheduled_date=p_date) then 'leave'
      when t.closed + t.running >= 1 then 'present'
      when p_now >= b.hi then 'absent' else 'pending' end,
    'isRestDay', coalesce(g.minutes = 0, false),
    'goalAchieved', case when g.minutes > 0 then t.closed + t.running >= g.minutes * 60 else null end)
  from totals t cross join bounds b cross join goal g;
$$;

-- Actual study seconds/goal completion remain intact; leave days cannot earn leave.
create or replace function public._leave_earned_at(p_uid uuid, p_week date, p_now timestamptz) returns timestamptz
language sql stable set search_path = '' as $$
  select completed_at from (
    select public._goal_completed_at(p_uid, p_week + d, p_now) as completed_at
    from generate_series(0, 6) d
    where not exists(select 1 from public.leave_grants l
      where l.user_id=p_uid and l.scheduled_date=p_week+d)
  ) days where completed_at is not null order by completed_at offset 5 limit 1;
$$;

create or replace function public.schedule_leave(p_grant_id uuid, p_date date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_now timestamptz; v_grant public.leave_grants;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform 1 from public.profiles where id=v_uid and room_id=1 for update;
  if not found then raise exception 'Profile required' using errcode='42501'; end if;
  v_now := clock_timestamp();
  select * into v_grant from public.leave_grants where id=p_grant_id and user_id=v_uid;
  if not found then raise exception 'Grant not found' using errcode='22023'; end if;
  -- Repeating an identical reservation is safe, including after the day arrives.
  if p_date is not null and v_grant.scheduled_date = p_date then return public.get_leave_status(); end if;
  if p_date is null or p_date <= public.study_date(v_now)
    or (p_date + time '06:00') at time zone 'Asia/Seoul' >= v_grant.expires_at
    or public._leave_state(v_grant.scheduled_date,v_grant.expires_at,v_now) <> 'AVAILABLE' then
    raise exception 'Invalid reservation' using errcode='22023';
  end if;
  if exists(select 1 from public.leave_grants where user_id=v_uid and scheduled_date=p_date and id<>p_grant_id) then
    raise exception 'Date already reserved' using errcode='22023';
  end if;
  update public.leave_grants set scheduled_date=p_date where id=p_grant_id and user_id=v_uid;
  return public.get_leave_status();
end;
$$;


commit;
