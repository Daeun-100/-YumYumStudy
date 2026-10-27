begin;
-- Keep mutate_leave as the only client write API.
create or replace function public.schedule_leave(p_grant_id uuid, p_date date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_now timestamptz; v_grant public.leave_grants;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform 1 from public.profiles where id=v_uid and room_id=public.current_study_room() for update;
  if not found then raise exception 'Profile required' using errcode='42501'; end if;
  v_now := clock_timestamp();
  select * into v_grant from public.leave_grants where id=p_grant_id and user_id=v_uid;
  if not found then raise exception 'Grant not found' using errcode='22023'; end if;
  -- The profile lock and mutate_leave revision serialize a date move.
  -- One UPDATE preserves the original booking on every failure.
  -- Repeating an identical reservation is safe, including after the day arrives.
  if p_date is not null and v_grant.scheduled_date = p_date then return public.get_leave_status(); end if;
  if p_date is null or p_date <= public.study_date(v_now)
    or (p_date + time '06:00') at time zone 'Asia/Seoul' >= v_grant.expires_at
    or public._leave_state(v_grant.scheduled_date,v_grant.expires_at,v_now) not in ('AVAILABLE', 'SCHEDULED') then
    raise exception 'Invalid reservation' using errcode='22023';
  end if;
  if exists(select 1 from public.leave_grants where user_id=v_uid and scheduled_date=p_date and id<>p_grant_id) then
    raise exception 'Date already reserved' using errcode='22023';
  end if;
  update public.leave_grants set scheduled_date=p_date where id=p_grant_id and user_id=v_uid;
  return public.get_leave_status();
end;
$$;
revoke all on function public.schedule_leave(uuid,date) from public,anon,authenticated;
commit;
