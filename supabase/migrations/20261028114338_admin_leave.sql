begin;

-- Admin grants are always applied to a date, never a spendable balance.
alter table public.leave_grants add column reason text;
alter table public.leave_grants alter column earning_week drop not null;
alter table public.leave_grants alter column expires_at drop not null;
alter table public.leave_grants drop constraint leave_grants_kind_check;
alter table public.leave_grants add constraint leave_grants_kind_check check (kind in ('free','reward','admin'));
alter table public.leave_grants add constraint leave_grants_kind_shape check (
  (kind='admin' and earning_week is null and expires_at is null and scheduled_date is not null and approved_at is not null)
  or (kind in ('free','reward') and earning_week is not null and expires_at is not null)
);
alter table public.leave_grants add constraint leave_grants_finite_dates check (
  isfinite(earned_at) and isfinite(recorded_at)
  and (scheduled_date is null or isfinite(scheduled_date))
  and (approved_at is null or isfinite(approved_at))
);
alter table public.leave_grants drop constraint leave_grants_kind_expiry;
alter table public.leave_grants add constraint leave_grants_kind_expiry check (
  kind='admin' or expires_at=((earning_week + case when kind='free' then 7 else 21 end)+time '06:00') at time zone 'Asia/Seoul'
);
-- The existing week/earned_at checks pass NULL only for admin (shape above).
-- The existing user/week/kind UNIQUE still deduplicates automatic grants;
-- admin earning_week is NULL so it imposes no weekly quota. Keep one-per-day.
alter table public.leave_grants drop constraint leave_schedule_before_expiry;
alter table public.leave_grants add constraint leave_schedule_before_expiry check (
  kind='admin' or scheduled_date is null or (
    (scheduled_date+time '06:00') at time zone 'Asia/Seoul'<expires_at
    and ((scheduled_date+time '06:00') at time zone 'Asia/Seoul'>=earned_at
      or (approved_at is not null and approved_at>=earned_at
        and approved_at>=(scheduled_date+time '06:00') at time zone 'Asia/Seoul'
        and approved_at<((scheduled_date+1)+time '06:00') at time zone 'Asia/Seoul'))
    and (approved_at is null or (approved_at>=earned_at and approved_at<expires_at))
  )
);

-- Operational reason is private even via a direct table request, not just RPC.
revoke select on public.leave_grants from authenticated;
grant select (id,user_id,earning_week,earned_at,expires_at,recorded_at,scheduled_date,kind,approved_at)
  on public.leave_grants to authenticated;

-- Serialize direct admin SQL with app mutations and invalidate stale requests.
-- Invoker only: this does not grant any caller additional privileges.
create function public._admin_leave_revision() returns trigger
language plpgsql security invoker set search_path='' as $$
declare u uuid;
begin
  if TG_OP='DELETE' then
    if OLD.kind<>'admin' then return OLD; end if;
    u:=OLD.user_id;
  else
    if TG_OP='UPDATE' and (OLD.kind='admin' or NEW.kind='admin')
      and (OLD.user_id<>NEW.user_id or OLD.kind<>NEW.kind or OLD.id<>NEW.id) then
      raise exception 'Admin leave identity cannot be changed' using errcode='22023';
    end if;
    if NEW.kind<>'admin' then return NEW; end if;
    u:=NEW.user_id;
  end if;
  update public.profiles set leave_revision=leave_revision+1 where id=u;
  if not found then raise exception 'Profile required' using errcode='22023'; end if;
  if TG_OP='DELETE' then return OLD; end if;
  return NEW;
end; $$;
revoke all on function public._admin_leave_revision() from public,anon,authenticated,service_role;
create trigger admin_leave_revision before insert or update or delete on public.leave_grants
for each row execute function public._admin_leave_revision();

-- Called through administrator SQL, never an app RPC. Reuse p_id on retry.
create function public.admin_apply_leave(p_id uuid,p_uid uuid,p_date date,p_reason text default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare g public.leave_grants; n timestamptz; payload jsonb; previous jsonb;
begin
  if p_id is null or p_uid is null or p_date is null or not isfinite(p_date) then
    raise exception 'Grant ID, user and finite study date required' using errcode='22023'; end if;
  perform 1 from public.profiles where id=p_uid for update;
  if not found then raise exception 'Profile required' using errcode='22023'; end if;
  payload:=jsonb_build_object('action','admin_apply','grantId',p_id,'date',p_date,'reason',p_reason);
  select r.payload into previous from public.leave_requests r where user_id=p_uid and request_id=p_id;
  if found then
    if previous<>payload then raise exception 'Grant ID reused with different input' using errcode='22023'; end if;
    -- A retry must not restore an administrator-cancelled or moved grant.
    return p_id;
  end if;
  select * into g from public.leave_grants where id=p_id;
  if found then
    if g.user_id<>p_uid or g.kind<>'admin' or g.scheduled_date<>p_date or g.reason is distinct from p_reason then
      raise exception 'Grant ID reused with different input' using errcode='22023'; end if;
    insert into public.leave_requests(user_id,request_id,payload) values(p_uid,p_id,payload);
    return g.id;
  end if;
  if exists(select 1 from public.leave_grants where user_id=p_uid and scheduled_date=p_date) then
    raise exception 'Date already reserved' using errcode='22023'; end if;
  n:=clock_timestamp();
  insert into public.leave_grants(id,user_id,kind,earning_week,expires_at,earned_at,recorded_at,approved_at,scheduled_date,reason)
    values(p_id,p_uid,'admin',null,null,n,n,n,p_date,p_reason);
  insert into public.leave_requests(user_id,request_id,payload) values(p_uid,p_id,payload);
  return p_id;
end; $$;
revoke all on function public.admin_apply_leave(uuid,uuid,date,text) from public,anon,authenticated,service_role;

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
  if g.kind='admin' then raise exception 'Admin leave cannot be changed in the app' using errcode='22023'; end if;
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
  if g.kind='admin' then raise exception 'Admin leave cannot be changed in the app' using errcode='22023'; end if;
  if p_date is null then raise exception 'Date required' using errcode='22023'; end if;
  if g.scheduled_date is null then return public.get_leave_status(); end if;
  if g.scheduled_date<>p_date or public._leave_state(g.scheduled_date,g.expires_at,n)<>'SCHEDULED' then
    raise exception 'Cannot cancel this reservation' using errcode='22023'; end if;
  update public.leave_grants set scheduled_date=null,approved_at=null where id=p_grant_id and user_id=u;
  return public.get_leave_status();
end; $$;
revoke all on function public.cancel_leave(uuid,date) from public,anon,authenticated;

create or replace function public.mutate_leave(p_request_id uuid, p_revision bigint, p_action text, p_date date, p_grant_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); rev bigint; payload jsonb; previous jsonb; g uuid; n timestamptz;
begin
 perform public._require_admission();
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select leave_revision into rev from public.profiles where id=u and room_id=public.current_study_room() for update;
 if not found then raise exception 'Profile required' using errcode='42501'; end if;
 if p_request_id is null or p_revision is null or p_revision<0 or p_action is null or p_action not in ('schedule','cancel') or p_date is null then
   raise exception 'Invalid leave request' using errcode='22023'; end if;
 payload:=jsonb_build_object('revision',p_revision,'action',p_action,'date',p_date,'grantId',p_grant_id);
 select r.payload into previous from public.leave_requests r where user_id=u and request_id=p_request_id;
 if found then
   if previous<>payload then raise exception 'Request ID reused with different input' using errcode='22023'; end if;
   return public.get_leave_status();
 end if;
 if rev<>p_revision then raise exception 'Leave changed; refresh before making a new request' using errcode='22023'; end if;
 perform public.get_leave_status();
 n:=clock_timestamp();
 if p_action='schedule' then
   g:=p_grant_id;
   if g is null then
     select id into g from public.leave_grants where user_id=u and kind in ('free','reward') and scheduled_date is null and earned_at<=n
       and expires_at>n and expires_at>(p_date+time '06:00') at time zone 'Asia/Seoul'
       order by expires_at,earned_at,id limit 1;
     if g is null then raise exception 'No eligible leave' using errcode='22023'; end if;
   end if;
   perform public.schedule_leave(g,p_date);
 else
   if p_grant_id is null then raise exception 'Grant required for cancellation' using errcode='22023'; end if;
   perform public.cancel_leave(p_grant_id,p_date);
 end if;
 update public.profiles set leave_revision=leave_revision+1 where id=u;
 insert into public.leave_requests(user_id,request_id,payload) values(u,p_request_id,payload);
 return public.get_leave_status();
end;
$$;
create or replace function public._reconcile_leave_status() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_now timestamptz; v_first date; v_last date;
  v_week date; v_earned timestamptz; v_grants jsonb; v_available integer;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = v_uid and room_id = public.current_study_room() for update;
  if not found then raise exception 'Profile required' using errcode = '42501'; end if;
  v_now := clock_timestamp();
  perform public._grant_weekly_free_leave(v_now, v_uid);
  select min(public.study_date(started_at)) into v_first from public.study_sessions where user_id = v_uid;
  v_last := public.study_date(v_now);
  if v_first is not null then
    v_week := v_first - (extract(isodow from v_first)::integer - 1);
    while v_week <= v_last loop
      if not exists(select 1 from public.leave_grants where user_id = v_uid and earning_week = v_week and kind = 'reward') then
        v_earned := public._leave_earned_at(v_uid, v_week, v_now);
        if v_earned is not null then
          insert into public.leave_grants(user_id, earning_week, earned_at, expires_at)
            values(v_uid, v_week, v_earned, ((v_week + 21) + time '06:00') at time zone 'Asia/Seoul')
            on conflict (user_id, earning_week, kind) do nothing;
        end if;
      end if;
      v_week := v_week + 7;
    end loop;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'earningWeek', earning_week,
      'earnedAt', earned_at, 'expiresAt', expires_at, 'scheduledDate', scheduled_date,
      'status', public._leave_state(scheduled_date, expires_at, v_now)) order by earned_at desc,id), '[]'::jsonb),
    count(*) filter (where kind in ('free','reward') and public._leave_state(scheduled_date, expires_at, v_now) = 'AVAILABLE')
    into v_grants, v_available from public.leave_grants where user_id = v_uid;
  return jsonb_build_object('serverNow', v_now, 'data', jsonb_build_object(
    'availableCount', v_available, 'grants', v_grants));
end;
$$;

-- Internal functions remain callable only by existing definer wrappers.
revoke all on function public.schedule_leave(uuid,date),public.cancel_leave(uuid,date),public._reconcile_leave_status()
  from public,anon,authenticated;
revoke all on function public.mutate_leave(uuid,bigint,text,date,uuid) from public,anon,authenticated;
grant execute on function public.mutate_leave(uuid,bigint,text,date,uuid) to authenticated;

commit;
