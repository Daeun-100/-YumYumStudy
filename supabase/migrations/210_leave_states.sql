begin;

alter table public.leave_grants add column scheduled_date date;
alter table public.leave_grants add constraint leave_schedule_before_expiry check (
  scheduled_date is null or ((scheduled_date + time '06:00') at time zone 'Asia/Seoul' >= earned_at
  and (scheduled_date + time '06:00') at time zone 'Asia/Seoul' < expires_at));

-- Derive one state from server time; elapsed time never requires a cron write.
create function public._leave_state(p_date date, p_expiry timestamptz, p_now timestamptz)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_date is not null then case
      when p_now >= (p_date + time '06:00') at time zone 'Asia/Seoul' then 'USED'
      else 'SCHEDULED' end
    when p_now >= p_expiry then 'EXPIRED'
    else 'AVAILABLE' end;
$$;

create or replace function public.get_leave_status() returns jsonb
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
      'earnedAt', earned_at, 'expiresAt', expires_at, 'scheduledDate', scheduled_date,
      'status', public._leave_state(scheduled_date, expires_at, v_now)) order by earning_week desc), '[]'::jsonb),
    count(*) filter (where public._leave_state(scheduled_date, expires_at, v_now) = 'AVAILABLE')
    into v_grants, v_available from public.leave_grants where user_id = v_uid;
  return jsonb_build_object('serverNow', v_now, 'data', jsonb_build_object(
    'availableCount', v_available, 'grants', v_grants));
end;
$$;

-- Every operation locks the same profile as grant reconciliation.
create function public.schedule_leave(p_grant_id uuid, p_date date) returns jsonb
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
  update public.leave_grants set scheduled_date=p_date where id=p_grant_id and user_id=v_uid;
  return public.get_leave_status();
end;
$$;

-- Include the expected date so a stale cancellation cannot cancel a new booking.
create function public.cancel_leave(p_grant_id uuid, p_date date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_now timestamptz; v_grant public.leave_grants;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform 1 from public.profiles where id=v_uid and room_id=1 for update;
  if not found then raise exception 'Profile required' using errcode='42501'; end if;
  v_now := clock_timestamp();
  select * into v_grant from public.leave_grants where id=p_grant_id and user_id=v_uid;
  if not found then raise exception 'Grant not found' using errcode='22023'; end if;
  if p_date is null then raise exception 'Date required' using errcode='22023'; end if;
  if v_grant.scheduled_date is null then return public.get_leave_status(); end if;
  if v_grant.scheduled_date <> p_date
    or public._leave_state(v_grant.scheduled_date,v_grant.expires_at,v_now) <> 'SCHEDULED' then
    raise exception 'Cannot cancel this reservation' using errcode='22023';
  end if;
  update public.leave_grants set scheduled_date=null where id=p_grant_id and user_id=v_uid;
  return public.get_leave_status();
end;
$$;
revoke all on function public._leave_state(date,timestamptz,timestamptz),
  public.schedule_leave(uuid,date), public.cancel_leave(uuid,date) from public, anon, authenticated;
grant execute on function public.schedule_leave(uuid,date), public.cancel_leave(uuid,date) to authenticated;
commit;
