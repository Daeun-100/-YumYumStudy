begin;
-- Approved prefixes cannot be retracted by a delayed legacy/native stop.
-- The column is read-only through the existing Data API grants.
alter table public.study_sessions add column confirmed_through timestamptz;
alter table public.study_sessions add constraint study_confirmed_bounds check (
  confirmed_through is null or (confirmed_through >= started_at and (ended_at is null or confirmed_through <= ended_at))
);

create function public._protect_confirmed_study_time() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.confirmed_through is not null then
    new.confirmed_through := greatest(old.confirmed_through, new.confirmed_through);
    if new.ended_at is not null then new.ended_at := greatest(new.ended_at, new.confirmed_through); end if;
  end if;
  return new;
end; $$;
revoke all on function public._protect_confirmed_study_time() from public, anon, authenticated;
create trigger protect_confirmed_study_time before update on public.study_sessions
for each row execute function public._protect_confirmed_study_time();

alter function public._day_record(uuid,date,timestamptz) rename to _day_record_before_time_confirmation;
create function public._day_record(p_uid uuid,p_date date,p_now timestamptz) returns jsonb
language sql stable set search_path='' as $$
  with original as (
    select public._day_record_before_time_confirmation(p_uid,p_date,p_now) as day
  ), approved as (
    select coalesce(sum(greatest(0,floor(extract(epoch from
      least(coalesce(s.ended_at,s.confirmed_through,s.started_at),p_now,((p_date+1)+time '06:00') at time zone 'Asia/Seoul')
      - greatest(s.started_at,(p_date+time '06:00') at time zone 'Asia/Seoul'))))),0) as seconds
    from public.study_sessions s where s.user_id=p_uid
      and s.started_at < ((p_date+1)+time '06:00') at time zone 'Asia/Seoul'
      and coalesce(s.ended_at,s.confirmed_through,s.started_at) > (p_date+time '06:00') at time zone 'Asia/Seoul'
  )
  select day || jsonb_build_object('confirmedGoalAchieved',case when (day->>'goalMinutes')::int>0
    then approved.seconds >= (day->>'goalMinutes')::int*60 else null end,
    'goalAchieved',case when (day->>'goalMinutes')::int>0
    then approved.seconds >= (day->>'goalMinutes')::int*60 else null end)
  from original cross join approved;
$$;
revoke all on function public._day_record_before_time_confirmation(uuid,date,timestamptz),public._day_record(uuid,date,timestamptz) from public, anon, authenticated;

create function public.confirm_study_time(p_session_id uuid,p_observed_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); s public.study_sessions; n timestamptz;
begin
  perform public._require_admission();
  perform 1 from public.profiles where id=u and room_id=public.current_study_room() for update;
  if not found then raise exception 'Profile required' using errcode='42501'; end if;
  select * into s from public.study_sessions where id=p_session_id and user_id=u and room_id=public.current_study_room() for update;
  if not found then raise exception 'Session unavailable' using errcode='42501'; end if;
  n:=clock_timestamp();
  if p_observed_at is null or not isfinite(p_observed_at) or p_observed_at<s.started_at or p_observed_at>n then
    raise exception 'Invalid observation time' using errcode='22023';
  end if;
  -- A closed session cannot be reopened or extended by a late checkpoint.
  update public.study_sessions set confirmed_through=greatest(confirmed_through,least(p_observed_at,coalesce(ended_at,p_observed_at))) where id=s.id;
  return public.get_today();
end; $$;
revoke all on function public.confirm_study_time(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.confirm_study_time(uuid,timestamptz) to authenticated;

create or replace function public._goal_completed_at(p_uid uuid, p_date date, p_now timestamptz) returns timestamptz
language sql stable set search_path = '' as $$
  with bounds as (
    select (p_date + time '06:00') at time zone 'Asia/Seoul' as lo,
      ((p_date + 1) + time '06:00') at time zone 'Asia/Seoul' as hi
  ), goal as (
    select (select g.weekday_minutes[extract(isodow from p_date)::integer]
      from public.goal_versions g where g.user_id = p_uid and g.effective_date <= p_date
      order by g.effective_date desc limit 1) * 60 as seconds
  ), segments as (
    select s.id, greatest(s.started_at, b.lo) as lo,
      greatest(0, floor(extract(epoch from
        least(coalesce(s.ended_at, s.confirmed_through, s.started_at), b.hi, p_now) - greatest(s.started_at, b.lo)))) as seconds
    from public.study_sessions s cross join bounds b
    where s.user_id = p_uid and s.started_at < least(b.hi, p_now)
      and coalesce(s.ended_at, s.confirmed_through, s.started_at) > b.lo
  ), running as (
    select *, coalesce(sum(seconds) over (order by lo, id rows between unbounded preceding and 1 preceding), 0) as previous
    from segments
  )
  select r.lo + ((g.seconds - r.previous)::double precision * interval '1 second')
    from running r cross join goal g
    where g.seconds > 0 and r.previous < g.seconds and r.previous + r.seconds >= g.seconds
    order by r.lo, r.id limit 1;
$$;

commit;
