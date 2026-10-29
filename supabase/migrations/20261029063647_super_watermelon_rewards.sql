begin;

-- Private policy fixes the launch study date once, rather than moving it on reads.
create table public.watermelon_reward_policy (
  id boolean primary key default true check (id),
  starts_on date not null check (isfinite(starts_on)),
  policy_version text not null check (length(policy_version) between 1 and 80)
);
insert into public.watermelon_reward_policy(starts_on,policy_version)
values(public.study_date(clock_timestamp()),'daily-v1');

create table public.watermelon_balances (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  normal_balance bigint not null default 0 check (normal_balance between 0 and 9007199254740991),
  super_balance bigint not null default 0 check (super_balance between 0 and 9007199254740991),
  updated_at timestamptz not null default clock_timestamp()
);
create table public.watermelon_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  currency text not null check (currency in ('normal','super')),
  amount bigint not null check (amount<>0 and amount between -9007199254740991 and 9007199254740991),
  transaction_type text not null check (transaction_type in ('grant','spend','refund','adjustment')),
  source_type text not null check (source_type in ('daily_goal','achievement','purchase','admin_adjustment')),
  source_key text not null check (length(source_key) between 1 and 200),
  study_date date check (study_date is null or isfinite(study_date)),
  achievement_id text,
  policy_version text not null check (length(policy_version) between 1 and 80),
  occurred_at timestamptz not null check (isfinite(occurred_at)),
  recorded_at timestamptz not null default clock_timestamp(),
  related_transaction_id uuid,
  unique(user_id,source_type,source_key),
  unique(user_id,id),
  foreign key(user_id,related_transaction_id) references public.watermelon_transactions(user_id,id),
  check ((transaction_type in ('grant','refund') and amount>0)
    or (transaction_type='spend' and amount<0) or transaction_type='adjustment'),
  check (source_type<>'daily_goal' or (transaction_type='grant' and amount=1 and study_date is not null
    and source_key=study_date::text and achievement_id is null and related_transaction_id is null
    and occurred_at>=(study_date+time '06:00') at time zone 'Asia/Seoul'
    and occurred_at<=((study_date+1)+time '06:00') at time zone 'Asia/Seoul'
    and (currency='normal' or extract(isodow from study_date)=7))),
  check (source_type<>'achievement' or (achievement_id is not null and length(achievement_id)>0))
);
create index watermelon_transactions_user_recorded on public.watermelon_transactions(user_id,recorded_at desc,id);
alter table public.watermelon_reward_policy enable row level security;
alter table public.watermelon_balances enable row level security;
alter table public.watermelon_transactions enable row level security;
revoke all on public.watermelon_reward_policy,public.watermelon_balances,public.watermelon_transactions from public,anon,authenticated;

-- Existing ledger entries cannot be edited or removed. Account deletion may
-- cascade after its parent profile is deleted; corrections are new transactions.
create function public._watermelon_immutable() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP='DELETE' and not exists(select 1 from public.profiles where id=OLD.user_id) then return OLD; end if;
  raise exception 'Watermelon transactions are append-only' using errcode='22023';
end; $$;
create trigger watermelon_transactions_immutable before update or delete on public.watermelon_transactions
for each row execute function public._watermelon_immutable();

-- All internal posting paths share profile -> balance lock order. No app-facing
-- grant/spend/admin endpoint is introduced. Future achievements reuse this helper.
create function public._post_watermelon_transaction(
  p_uid uuid,p_currency text,p_amount bigint,p_transaction_type text,p_source_type text,p_source_key text,
  p_study_date date,p_achievement_id text,p_policy_version text,p_occurred_at timestamptz,p_related_id uuid default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare previous public.watermelon_transactions; result uuid;
begin
  perform 1 from public.profiles where id=p_uid for update;
  if not found then raise exception 'Profile required' using errcode='42501'; end if;
  insert into public.watermelon_balances(user_id) values(p_uid) on conflict(user_id) do nothing;
  perform 1 from public.watermelon_balances where user_id=p_uid for update;
  select * into previous from public.watermelon_transactions
    where user_id=p_uid and source_type=p_source_type and source_key=p_source_key;
  if found then
    if row(previous.currency,previous.amount,previous.transaction_type,previous.study_date,previous.achievement_id,
      previous.policy_version,previous.occurred_at,previous.related_transaction_id)
      is distinct from row(p_currency,p_amount,p_transaction_type,p_study_date,p_achievement_id,p_policy_version,p_occurred_at,p_related_id) then
      raise exception 'Watermelon source reused with different input' using errcode='22023'; end if;
    return previous.id;
  end if;
  insert into public.watermelon_transactions(user_id,currency,amount,transaction_type,source_type,source_key,
    study_date,achievement_id,policy_version,occurred_at,related_transaction_id)
  values(p_uid,p_currency,p_amount,p_transaction_type,p_source_type,p_source_key,p_study_date,p_achievement_id,p_policy_version,p_occurred_at,p_related_id)
  returning id into result;
  update public.watermelon_balances set
    normal_balance=normal_balance+case when p_currency='normal' then p_amount else 0 end,
    super_balance=super_balance+case when p_currency='super' then p_amount else 0 end,
    updated_at=clock_timestamp()
  where user_id=p_uid
    and (p_currency<>'normal' or normal_balance+p_amount>=0)
    and (p_currency<>'super' or super_balance+p_amount>=0);
  if not found then raise exception 'Insufficient watermelon balance' using errcode='22023'; end if;
  return result;
end; $$;

-- Full-week eligibility uses historical goals, clipped sessions and every leave
-- kind; presentation remains independent of both the launch date and the wallet.
create function public._super_watermelon_earned_at(p_uid uuid,p_week date,p_now timestamptz)
returns timestamptz language sql stable set search_path='' as $$
  select case when count(completed)=7 then max(completed) end from (
    select public._goal_completed_at(p_uid,p_week+d,p_now) as completed
    from generate_series(0,6) d
    where extract(isodow from p_week)=1 and p_week+6<=public.study_date(p_now)
      and not exists(select 1 from public.leave_grants l where l.user_id=p_uid and l.scheduled_date=p_week+d)
  ) days;
$$;

-- Only the queried dates at/after launch earn currency. Older records can still
-- display gold. A source date is shared by normal/super, never two daily grants.
create function public._reconcile_watermelons(p_uid uuid,p_from date,p_to date,p_now timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare d date; first_date date; version text; completed timestamptz; currency text;
begin
  select greatest(p_from,starts_on),policy_version into first_date,version from public.watermelon_reward_policy where id;
  if first_date is null then raise exception 'Watermelon policy required' using errcode='22023'; end if;
  d:=first_date;
  while d<=least(p_to,public.study_date(p_now)) loop
    if not exists(select 1 from public.watermelon_transactions t where t.user_id=p_uid and t.source_type='daily_goal' and t.source_key=d::text)
      and not exists(select 1 from public.leave_grants l where l.user_id=p_uid and l.scheduled_date=d) then
      completed:=public._goal_completed_at(p_uid,d,p_now);
      if completed is not null then
        currency:=case when extract(isodow from d)=7 and public._super_watermelon_earned_at(p_uid,d-6,p_now) is not null then 'super' else 'normal' end;
        perform public._post_watermelon_transaction(p_uid,currency,1,'grant','daily_goal',d::text,d,null,version,completed);
      end if;
    end if;
    d:=d+1;
  end loop;
end; $$;

alter function public._day_record(uuid,date,timestamptz) rename to _day_record_before_super_watermelon;
create function public._day_record(p_uid uuid,p_date date,p_now timestamptz) returns jsonb
language sql stable set search_path='' as $$
  select public._day_record_before_super_watermelon(p_uid,p_date,p_now) || jsonb_build_object(
    'superWatermelon',case when extract(isodow from p_date)=7 and p_date<=public.study_date(p_now)
      then public._super_watermelon_earned_at(p_uid,p_date-6,p_now) is not null else false end);
$$;

alter function public.get_today() rename to _today_before_super_watermelon;
create function public.get_today() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); n timestamptz;
begin
  perform public._require_admission();
  perform 1 from public.profiles where id=u and room_id=public.current_study_room() for update;
  if not found then raise exception 'Profile required' using errcode='42501'; end if;
  n:=statement_timestamp();
  perform public._reconcile_watermelons(u,public.study_date(n)-6,public.study_date(n),n);
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
  perform public._reconcile_watermelons(u,p_from,p_to,n);
  select jsonb_agg(public._day_record(u,p_from+d,n) order by d desc) into days from generate_series(0,p_to-p_from) d;
  return jsonb_build_object('serverNow',n,'data',coalesce(days,'[]'::jsonb));
end; $$;

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
  perform public._reconcile_watermelons(p_member_id,p_from,p_to,n);
  select jsonb_agg(public._day_record(p_member_id,p_from+d,n) order by d) into days from generate_series(0,p_to-p_from) d;
  return jsonb_build_object('serverNow',n,'data',coalesce(days,'[]'::jsonb));
end; $$;

-- Constant-size own-wallet read. It neither scans the ledger nor reconciles
-- history; users without a wallet row have a zero balance.
create function public.get_watermelon_balance() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); normal bigint; super bigint;
begin
  perform public._require_admission();
  if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select b.normal_balance,b.super_balance into normal,super from public.watermelon_balances b
    join public.profiles p on p.id=b.user_id where p.id=u and p.room_id=public.current_study_room();
  return jsonb_build_object('serverNow',statement_timestamp(),'data',jsonb_build_object(
    'normalBalance',coalesce(normal,0),'superBalance',coalesce(super,0)));
end; $$;

alter function public._leave_today_protected(uuid,date,timestamptz) rename to _leave_today_protected_before_super_watermelon;
create function public._leave_today_protected(p_uid uuid,p_date date,p_now timestamptz)
returns boolean language sql stable set search_path='' as $$
  select public._leave_today_protected_before_super_watermelon(p_uid,p_date,p_now)
    or (extract(isodow from p_date)=7 and (
      exists(select 1 from public.watermelon_transactions t where t.user_id=p_uid and t.source_type='daily_goal'
        and t.source_key=p_date::text and t.currency='super' and t.occurred_at<=p_now)
      or public._super_watermelon_earned_at(p_uid,p_date-6,p_now) is not null));
$$;

revoke all on function public._watermelon_immutable(),
  public._post_watermelon_transaction(uuid,text,bigint,text,text,text,date,text,text,timestamptz,uuid),
  public._super_watermelon_earned_at(uuid,date,timestamptz),public._reconcile_watermelons(uuid,date,date,timestamptz),
  public._day_record_before_super_watermelon(uuid,date,timestamptz),public._day_record(uuid,date,timestamptz),
  public._today_before_super_watermelon(),public._leave_today_protected_before_super_watermelon(uuid,date,timestamptz),
  public._leave_today_protected(uuid,date,timestamptz),public.get_today(),public.get_history(date,date),
  public.get_member_history(uuid,date,date),public.get_watermelon_balance() from public,anon,authenticated;
grant execute on function public.get_today(),public.get_history(date,date),public.get_member_history(uuid,date,date),
  public.get_watermelon_balance() to authenticated;
commit;
