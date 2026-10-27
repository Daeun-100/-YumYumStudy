begin;
-- Existing reservations retain their dates; approval times are unknown for legacy rows.
alter table public.leave_grants add column approved_at timestamptz;
alter table public.leave_grants drop constraint leave_schedule_before_expiry;
alter table public.leave_grants add constraint leave_schedule_before_expiry check (
  scheduled_date is null or (
    (scheduled_date + time '06:00') at time zone 'Asia/Seoul' < expires_at
    and ((scheduled_date + time '06:00') at time zone 'Asia/Seoul' >= earned_at
      or (approved_at is not null and approved_at >= earned_at
        and approved_at >= (scheduled_date + time '06:00') at time zone 'Asia/Seoul'
        and approved_at < ((scheduled_date+1) + time '06:00') at time zone 'Asia/Seoul'))
    and (approved_at is null or (approved_at >= earned_at and approved_at < expires_at))));

-- Private and deterministic for boundary tests. Exclude the target day before counting.
create function public._leave_today_protected(p_uid uuid, p_date date, p_now timestamptz)
returns boolean language sql stable set search_path='' as $$
  with week as (select p_date-(extract(isodow from p_date)::integer-1) as w)
  select (exists(select 1 from public.leave_grants l, week
      where l.user_id=p_uid and l.earning_week=week.w and l.kind='reward')
    or public._leave_earned_at(p_uid,week.w,p_now) is not null)
    and (select count(*) from generate_series(0,6) d
      where week.w+d<>p_date
        and public._goal_completed_at(p_uid,week.w+d,p_now) is not null
        and not exists(select 1 from public.leave_grants l
          where l.user_id=p_uid and l.scheduled_date=week.w+d)) < 6
  from week;
$$;
revoke all on function public._leave_today_protected(uuid,date,timestamptz) from public,anon,authenticated;

create or replace function public.schedule_leave(p_grant_id uuid, p_date date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); n timestamptz; g public.leave_grants;
begin
  perform public._require_admission();
  if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform 1 from public.profiles where id=u and room_id=public.current_study_room() for update;
  if not found then raise exception 'Profile required' using errcode='42501'; end if;
  n:=clock_timestamp();
  select * into g from public.leave_grants where id=p_grant_id and user_id=u;
  if not found then raise exception 'Grant not found' using errcode='22023'; end if;
  if p_date is not null and g.scheduled_date=p_date then return public.get_leave_status(); end if;
  if p_date is null or p_date<public.study_date(n) then
    raise exception 'Study date changed; confirm again' using errcode='22023'; end if;
  if g.earned_at>n or g.expires_at<=n
    or (p_date+time '06:00') at time zone 'Asia/Seoul'>=g.expires_at
    or public._leave_state(g.scheduled_date,g.expires_at,n) not in ('AVAILABLE','SCHEDULED') then
    raise exception 'Invalid reservation' using errcode='22023'; end if;
  if exists(select 1 from public.leave_grants where user_id=u and scheduled_date=p_date and id<>p_grant_id) then
    raise exception 'Date already reserved' using errcode='22023'; end if;
  if p_date=public.study_date(n) and public._leave_today_protected(u,p_date,n) then
    raise exception 'Today is required for earned reward' using errcode='22023'; end if;
  update public.leave_grants set scheduled_date=p_date,approved_at=n where id=p_grant_id and user_id=u;
  return public.get_leave_status();
end; $$;
revoke all on function public.schedule_leave(uuid,date) from public,anon,authenticated;

create or replace function public.cancel_leave(p_grant_id uuid,p_date date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); n timestamptz; g public.leave_grants;
begin
  perform public._require_admission();
  if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform 1 from public.profiles where id=u and room_id=public.current_study_room() for update;
  if not found then raise exception 'Profile required' using errcode='42501'; end if;
  n:=clock_timestamp();
  select * into g from public.leave_grants where id=p_grant_id and user_id=u;
  if not found then raise exception 'Grant not found' using errcode='22023'; end if;
  if p_date is null then raise exception 'Date required' using errcode='22023'; end if;
  if g.scheduled_date is null then return public.get_leave_status(); end if;
  if g.scheduled_date<>p_date or public._leave_state(g.scheduled_date,g.expires_at,n)<>'SCHEDULED' then
    raise exception 'Cannot cancel this reservation' using errcode='22023'; end if;
  update public.leave_grants set scheduled_date=null,approved_at=null where id=p_grant_id and user_id=u;
  return public.get_leave_status();
end; $$;
revoke all on function public.cancel_leave(uuid,date) from public,anon,authenticated;

-- Extend responses without changing the existing reconciler or admission wrapper.
alter function public.get_leave_status() rename to _leave_status_before_same_day;
revoke all on function public._leave_status_before_same_day() from public,anon,authenticated;
create function public.get_leave_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; grants jsonb;
begin
  result:=public._leave_status_before_same_day();
  select coalesce(jsonb_agg(item || jsonb_build_object('approvedAt',g.approved_at)), '[]'::jsonb)
    into grants from jsonb_array_elements(result->'data'->'grants') item
    join public.leave_grants g on g.id=(item->>'id')::uuid and g.user_id=auth.uid();
  return jsonb_set(result,'{data,grants}',grants);
end; $$;
revoke all on function public.get_leave_status() from public,anon,authenticated;
grant execute on function public.get_leave_status() to authenticated;
commit;
