begin;

create or replace function public.save_goals(p_weekday_minutes integer[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_now timestamptz; v_effective date;
begin
  perform public._require_admission();
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_weekday_minutes is null or cardinality(p_weekday_minutes) <> 7
    or array_ndims(p_weekday_minutes) <> 1 or array_lower(p_weekday_minutes, 1) <> 1
    or exists(select 1 from unnest(p_weekday_minutes) n where n < 0 or n > 1440) then
    raise exception 'Seven goals between 0 and 1440 minutes or null required' using errcode = '22023';
  end if;
  perform 1 from public.profiles where id = v_uid and room_id = public.current_study_room() for update;
  if not found then raise exception 'Profile required' using errcode = '42501'; end if;
  -- Evaluate after acquiring the lock so a queued request crossing 06:00 uses the new day.
  v_now := clock_timestamp();
  -- Existing versions are the durable first-save marker, even if all days are null.
  v_effective := public.study_date(v_now) + case when exists (
    select 1 from public.goal_versions where user_id = v_uid
  ) then 1 else 0 end;
  insert into public.goal_versions(user_id, effective_date, weekday_minutes)
    values(v_uid, v_effective, p_weekday_minutes)
    on conflict (user_id, effective_date) do update set weekday_minutes = excluded.weekday_minutes;
  return jsonb_build_object('serverNow', v_now, 'data', jsonb_build_object(
    'effectiveDate', v_effective, 'goals', to_jsonb(p_weekday_minutes)));
end;
$$;

create or replace function public.get_goal_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_now timestamptz := statement_timestamp();
  v_date date; v_current jsonb; v_scheduled jsonb;
begin
  perform public._require_admission();
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  v_date := public.study_date(v_now);
  select to_jsonb(weekday_minutes) into v_current from public.goal_versions
    where user_id = v_uid and effective_date <= v_date order by effective_date desc limit 1;
  select to_jsonb(weekday_minutes) into v_scheduled from public.goal_versions
    where user_id = v_uid and effective_date = v_date + 1;
  return jsonb_build_object('serverNow', v_now, 'data', jsonb_build_object(
    'isFirstSetup', not exists(select 1 from public.goal_versions where user_id = v_uid),
    'current', coalesce(v_current, '[null,null,null,null,null,null,null]'::jsonb),
    'scheduled', v_scheduled, 'effectiveDate', case when v_scheduled is null then null else v_date + 1 end));
end;
$$;

notify pgrst, 'reload schema';
commit;
