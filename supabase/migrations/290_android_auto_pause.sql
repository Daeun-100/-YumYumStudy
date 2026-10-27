-- Additive RPC: Android reports the observed departure time, including offline retries.
-- Only the authenticated user's session in the current room can be shortened.
begin;
create or replace function public.stop_study_on_exit(p_session_id uuid, p_stopped_at timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_session public.study_sessions; v_end timestamptz;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_session_id is null or p_stopped_at is null or not isfinite(p_stopped_at) then
    raise exception 'Session and finite departure time required' using errcode = '22023';
  end if;
  perform 1 from public.profiles where id = v_uid and room_id = public.current_study_room() for update;
  if not found then raise exception 'Profile required' using errcode = '42501'; end if;
  select * into v_session from public.study_sessions
    where id = p_session_id and user_id = v_uid and room_id = public.current_study_room() for update;
  if not found then raise exception 'Session unavailable' using errcode = '42501'; end if;
  v_end := greatest(v_session.started_at, least(p_stopped_at, clock_timestamp()));
  -- Earliest stop wins: retries and racing manual stops can never add time back.
  update public.study_sessions set ended_at = least(coalesce(ended_at, v_end), v_end)
    where id = v_session.id returning * into v_session;
  return jsonb_build_object('serverNow', clock_timestamp(), 'data', public._session_json(v_session));
end;
$$;
revoke all on function public.stop_study_on_exit(uuid,timestamptz) from public, anon;
grant execute on function public.stop_study_on_exit(uuid,timestamptz) to authenticated;
commit;
