begin;

-- One immutable entitlement per user and earning week. No initial/monthly grant.
create table public.leave_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  earning_week date not null check (extract(isodow from earning_week) = 1),
  earned_at timestamptz not null,
  expires_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  unique (user_id, earning_week),
  check (earned_at >= (earning_week + time '06:00') at time zone 'Asia/Seoul'
    and earned_at <= ((earning_week + 7) + time '06:00') at time zone 'Asia/Seoul'),
  check (expires_at = ((earning_week + 21) + time '06:00') at time zone 'Asia/Seoul')
);
alter table public.leave_grants enable row level security;
revoke all on public.leave_grants from public, anon, authenticated;
grant select on public.leave_grants to authenticated;
create policy "Read own leave grants" on public.leave_grants for select to authenticated
  using (user_id = (select auth.uid()));

-- Match _day_record's sum of integer seconds per date-clipped session.
-- Return the actual crossing time, not the later time when the app opens.
create function public._goal_completed_at(p_uid uuid, p_date date, p_now timestamptz) returns timestamptz
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
        least(coalesce(s.ended_at, p_now), b.hi, p_now) - greatest(s.started_at, b.lo)))) as seconds
    from public.study_sessions s cross join bounds b
    where s.user_id = p_uid and s.started_at < least(b.hi, p_now)
      and coalesce(s.ended_at, p_now) > b.lo
  ), running as (
    select *, coalesce(sum(seconds) over (order by lo, id rows between unbounded preceding and 1 preceding), 0) as previous
    from segments
  )
  select r.lo + ((g.seconds - r.previous)::double precision * interval '1 second')
    from running r cross join goal g
    where g.seconds > 0 and r.previous < g.seconds and r.previous + r.seconds >= g.seconds
    order by r.lo, r.id limit 1;
$$;

create function public._leave_earned_at(p_uid uuid, p_week date, p_now timestamptz) returns timestamptz
language sql stable set search_path = '' as $$
  select completed_at from (
    select public._goal_completed_at(p_uid, p_week + d, p_now) as completed_at
    from generate_series(0, 6) d
  ) days where completed_at is not null order by completed_at offset 5 limit 1;
$$;

-- A query materializes any missing entitlements, including weeks while the app was closed.
-- No polling/cron is needed to preserve earning time or the fixed expiry boundary.
create function public.get_leave_status() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_now timestamptz; v_first date; v_last date;
  v_week date; v_earned timestamptz; v_grants jsonb; v_available integer;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = v_uid and room_id = 1 for update;
  if not found then raise exception 'Profile required' using errcode = '42501'; end if;
  v_now := clock_timestamp();
  select min(public.study_date(started_at)) into v_first from public.study_sessions where user_id = v_uid;
  v_last := public.study_date(v_now);
  if v_first is not null then
    v_week := v_first - (extract(isodow from v_first)::integer - 1);
    while v_week <= v_last loop
      if not exists(select 1 from public.leave_grants where user_id = v_uid and earning_week = v_week) then
        v_earned := public._leave_earned_at(v_uid, v_week, v_now);
        if v_earned is not null then
          insert into public.leave_grants(user_id, earning_week, earned_at, expires_at)
            values(v_uid, v_week, v_earned, ((v_week + 21) + time '06:00') at time zone 'Asia/Seoul')
            on conflict (user_id, earning_week) do nothing;
        end if;
      end if;
      v_week := v_week + 7;
    end loop;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'earningWeek', earning_week,
      'earnedAt', earned_at, 'expiresAt', expires_at) order by earning_week desc), '[]'::jsonb),
    count(*) filter (where earned_at <= v_now and expires_at > v_now)
    into v_grants, v_available from public.leave_grants where user_id = v_uid;
  return jsonb_build_object('serverNow', v_now, 'data', jsonb_build_object(
    'availableCount', v_available, 'grants', v_grants));
end;
$$;

revoke all on function public._goal_completed_at(uuid,date,timestamptz),
  public._leave_earned_at(uuid,date,timestamptz), public.get_leave_status() from public, anon, authenticated;
grant execute on function public.get_leave_status() to authenticated;

commit;
