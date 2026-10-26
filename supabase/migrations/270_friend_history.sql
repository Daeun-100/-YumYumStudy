begin;
-- Only confirmed members of the caller's admitted room may share daily totals.
create function public.get_member_history(p_member_id uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_now timestamptz := statement_timestamp(); v_days jsonb;
begin
 perform public._require_admission();
 if not exists(select 1 from public.profiles where id=p_member_id and room_id=public.current_study_room() and name_confirmed and invite_verified_at is not null) then
  raise exception 'Room member required' using errcode='42501';
 end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>365 then
  raise exception 'Invalid date range (maximum 366 days)' using errcode='22023';
 end if;
 select jsonb_agg(public._day_record(p_member_id,p_from+d,v_now) order by d)
 into v_days from generate_series(0,p_to-p_from) d;
 return jsonb_build_object('serverNow',v_now,'data',coalesce(v_days,'[]'::jsonb));
end; $$;
revoke all on function public.get_member_history(uuid,date,date) from public,anon,authenticated;
grant execute on function public.get_member_history(uuid,date,date) to authenticated;
commit;
