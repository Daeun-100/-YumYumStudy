begin;

-- Internal award markers, not a wallet or collection API.
create table public.super_watermelon_awards (
  user_id uuid not null references public.profiles(id) on delete cascade,
  earning_week date not null check (isfinite(earning_week) and extract(isodow from earning_week)=1),
  earned_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  primary key (user_id, earning_week),
  check (earned_at>=((earning_week+6)+time '06:00') at time zone 'Asia/Seoul'
    and earned_at<=((earning_week+7)+time '06:00') at time zone 'Asia/Seoul')
);
alter table public.super_watermelon_awards enable row level security;
revoke all on public.super_watermelon_awards from public,anon,authenticated;

-- Eligibility uses all seven dates, independently of the history query window.
create function public._super_watermelon_earned_at(p_uid uuid,p_week date,p_now timestamptz)
returns timestamptz language sql stable set search_path='' as $$
  select case when count(completed)=7 then max(completed) end from (
    select public._goal_completed_at(p_uid,p_week+d,p_now) as completed
    from generate_series(0,6) d
    where extract(isodow from p_week)=1 and p_week+6<=public.study_date(p_now)
      and not exists(select 1 from public.leave_grants l where l.user_id=p_uid and l.scheduled_date=p_week+d)
  ) days;
$$;

-- Caller holds the profile lock shared with leave mutations and admin grants.
create function public._reconcile_super_watermelons(p_uid uuid,p_from date,p_to date,p_now timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare w date; earned timestamptz;
begin
  w:=p_from-(extract(isodow from p_from)::int-1);
  while w+6<=least(p_to,public.study_date(p_now)) loop
    if not exists(select 1 from public.super_watermelon_awards a where a.user_id=p_uid and a.earning_week=w) then
      earned:=public._super_watermelon_earned_at(p_uid,w,p_now);
      if earned is not null then
        insert into public.super_watermelon_awards(user_id,earning_week,earned_at)
          values(p_uid,w,earned) on conflict (user_id,earning_week) do nothing;
      end if;
    end if;
    w:=w+7;
  end loop;
end; $$;

-- Ordinary watermelon stays a date marker. Sunday gold replaces that marker.
alter function public._day_record(uuid,date,timestamptz) rename to _day_record_before_super_watermelon;
create function public._day_record(p_uid uuid,p_date date,p_now timestamptz) returns jsonb
language sql stable set search_path='' as $$
  select public._day_record_before_super_watermelon(p_uid,p_date,p_now) || jsonb_build_object(
    'superWatermelon',case when extract(isodow from p_date)=7 and p_date<=public.study_date(p_now) then
      exists(select 1 from public.super_watermelon_awards a where a.user_id=p_uid and a.earning_week=p_date-6 and a.earned_at<=p_now)
      or public._super_watermelon_earned_at(p_uid,p_date-6,p_now) is not null
    else false end);
$$;

-- Missing awards materialize on queries, without background polling.
alter function public.get_today() rename to _today_before_super_watermelon;
create function public.get_today() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); n timestamptz;
begin
  perform public._require_admission();
  perform 1 from public.profiles where id=u and room_id=public.current_study_room() for update;
  if not found then raise exception 'Profile required' using errcode='42501'; end if;
  n:=statement_timestamp();
  perform public._reconcile_super_watermelons(u,public.study_date(n)-6,public.study_date(n),n);
  return public._today_before_super_watermelon();
end; $$;

create or replace function public.get_history(p_from date,p_to date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); n timestamptz; days jsonb;
begin
  perform public._require_admission();
  if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_from>p_to or p_to-p_from>365 then
    raise exception 'Invalid date range (maximum 366 days)' using errcode='22023'; end if;
  perform 1 from public.profiles where id=u and room_id=public.current_study_room() for update;
  if not found then raise exception 'Profile required' using errcode='42501'; end if;
  n:=clock_timestamp();
  perform public._reconcile_super_watermelons(u,p_from,p_to,n);
  select jsonb_agg(public._day_record(u,p_from+d,n) order by d desc) into days from generate_series(0,p_to-p_from) d;
  return jsonb_build_object('serverNow',n,'data',coalesce(days,'[]'::jsonb));
end; $$;

-- Shared records use the same award and room boundary, including Sunday-only
-- windows. Lock the target profile before materialization, never the caller's.
create or replace function public.get_member_history(p_member_id uuid,p_from date,p_to date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n timestamptz; days jsonb;
begin
  perform public._require_admission();
  perform 1 from public.profiles where id=p_member_id and room_id=public.current_study_room()
    and name_confirmed and invite_verified_at is not null for update;
  if not found then raise exception 'Room member required' using errcode='42501'; end if;
  if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_from>p_to or p_to-p_from>365 then
    raise exception 'Invalid date range (maximum 366 days)' using errcode='22023'; end if;
  n:=clock_timestamp();
  perform public._reconcile_super_watermelons(p_member_id,p_from,p_to,n);
  select jsonb_agg(public._day_record(p_member_id,p_from+d,n) order by d) into days from generate_series(0,p_to-p_from) d;
  return jsonb_build_object('serverNow',n,'data',coalesce(days,'[]'::jsonb));
end; $$;

-- Protect the seventh day even before the first reward query. Admin overrides
-- remain possible and previously awarded gold is never deleted.
alter function public._leave_today_protected(uuid,date,timestamptz) rename to _leave_today_protected_before_super_watermelon;
create function public._leave_today_protected(p_uid uuid,p_date date,p_now timestamptz)
returns boolean language sql stable set search_path='' as $$
  select public._leave_today_protected_before_super_watermelon(p_uid,p_date,p_now)
    or (extract(isodow from p_date)=7 and (
      exists(select 1 from public.super_watermelon_awards a where a.user_id=p_uid and a.earning_week=p_date-6 and a.earned_at<=p_now)
      or public._super_watermelon_earned_at(p_uid,p_date-6,p_now) is not null));
$$;

revoke all on function public._super_watermelon_earned_at(uuid,date,timestamptz),
  public._reconcile_super_watermelons(uuid,date,date,timestamptz),
  public._day_record_before_super_watermelon(uuid,date,timestamptz),public._day_record(uuid,date,timestamptz),
  public._today_before_super_watermelon(),public._leave_today_protected_before_super_watermelon(uuid,date,timestamptz),
  public._leave_today_protected(uuid,date,timestamptz),public.get_today(),public.get_history(date,date),public.get_member_history(uuid,date,date)
  from public,anon,authenticated;
grant execute on function public.get_today(),public.get_history(date,date),public.get_member_history(uuid,date,date) to authenticated;
commit;
