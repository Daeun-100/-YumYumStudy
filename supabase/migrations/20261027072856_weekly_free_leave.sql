begin;
-- Existing grants remain rewards. One grant per user, week AND kind.
alter table public.leave_grants add column kind text not null default 'reward'
  check (kind in ('reward', 'free'));
alter table public.leave_grants drop constraint leave_grants_user_id_earning_week_key;
alter table public.leave_grants add constraint leave_grants_user_week_kind_key unique(user_id, earning_week, kind);
alter table public.leave_grants drop constraint leave_grants_check1;
alter table public.leave_grants add constraint leave_grants_kind_expiry check (
  expires_at = ((earning_week + case when kind = 'free' then 7 else 21 end) + time '06:00') at time zone 'Asia/Seoul'
);
alter table public.leave_grants add constraint leave_grants_free_earned_at check (
  kind <> 'free' or earned_at = (earning_week + time '06:00') at time zone 'Asia/Seoul'
);

-- Internal only: cron calls as postgres; reconciliation calls inside its definer.
-- Deliberately no 2026-10-26 grant. That week requires separate user authorization.
create function public._grant_weekly_free_leave(p_now timestamptz default clock_timestamp(), p_uid uuid default null)
returns void language plpgsql set search_path='' as $$
declare d date := public.study_date(p_now); w date; u uuid;
begin
  w := d - (extract(isodow from d)::integer - 1);
  if w < date '2026-11-02' then return; end if;
  for u in select id from public.profiles
    where (p_uid is null or id=p_uid) and invite_verified_at is not null and name_confirmed
    and created_at <= p_now order by id for update
  loop
    insert into public.leave_grants(user_id, earning_week, kind, earned_at, expires_at)
    values(u, w, 'free', (w + time '06:00') at time zone 'Asia/Seoul',
      ((w+7) + time '06:00') at time zone 'Asia/Seoul')
    on conflict(user_id, earning_week, kind) do nothing;
  end loop;
end; $$;
revoke all on function public._grant_weekly_free_leave(timestamptz,uuid) from public,anon,authenticated;

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
      'status', public._leave_state(scheduled_date, expires_at, v_now)) order by earning_week desc), '[]'::jsonb),
    count(*) filter (where public._leave_state(scheduled_date, expires_at, v_now) = 'AVAILABLE')
    into v_grants, v_available from public.leave_grants where user_id = v_uid;
  return jsonb_build_object('serverNow', v_now, 'data', jsonb_build_object(
    'availableCount', v_available, 'grants', v_grants));
end;
$$;

-- Every operation locks the same profile as grant reconciliation.
revoke all on function public._reconcile_leave_status() from public,anon,authenticated;
create extension if not exists pg_cron;
-- Sunday 21:00 UTC = Monday 06:00 Asia/Seoul.
select cron.schedule('weekly-free-leave', '0 21 * * 0', 'select public._grant_weekly_free_leave();');
commit;
