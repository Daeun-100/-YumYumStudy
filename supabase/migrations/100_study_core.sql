begin;

create table public.study_room (
  id smallint primary key default 1 check (id = 1),
  name text not null
);
insert into public.study_room (id, name) values (1, '얌얌스터디');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  room_id smallint not null default 1 references public.study_room(id) check (room_id = 1),
  display_name text not null check (length(btrim(display_name)) between 1 and 40),
  created_at timestamptz not null default clock_timestamp()
);
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_id smallint not null default 1 references public.study_room(id) check (room_id = 1),
  started_at timestamptz not null default clock_timestamp(),
  ended_at timestamptz,
  check (ended_at is null or ended_at >= started_at)
);
create unique index one_running_session_per_user on public.study_sessions(user_id) where ended_at is null;
create index study_sessions_user_time on public.study_sessions(user_id, started_at);

-- Maps even a coalesced second request to its original session after that session ends.
create table public.study_start_requests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  session_id uuid not null references public.study_sessions(id) on delete cascade,
  primary key (user_id, request_id)
);
create table public.goal_versions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  effective_date date not null,
  weekday_minutes integer[] not null,
  primary key (user_id, effective_date),
  check (cardinality(weekday_minutes) = 7 and array_ndims(weekday_minutes) = 1 and array_lower(weekday_minutes, 1) = 1),
  check (0 <= all(weekday_minutes))
);

alter table public.study_room enable row level security;
alter table public.profiles enable row level security;
alter table public.study_sessions enable row level security;
alter table public.study_start_requests enable row level security;
alter table public.goal_versions enable row level security;
revoke all on public.study_room, public.profiles, public.study_sessions, public.study_start_requests, public.goal_versions from public, anon, authenticated;
grant select on public.study_room, public.profiles, public.study_sessions, public.goal_versions to authenticated;
create policy "Read fixed room" on public.study_room for select to authenticated using (id = 1);
create policy "Read room profiles" on public.profiles for select to authenticated using (room_id = 1);
create policy "Read room sessions" on public.study_sessions for select to authenticated using (room_id = 1);
create policy "Read room goals" on public.goal_versions for select to authenticated
  using (exists(select 1 from public.profiles p where p.id = user_id and p.room_id = 1));
-- No client write policies/grants. Writes are restricted to owner-checked RPCs below.

create function public.study_date(p_at timestamptz) returns date
language sql immutable set search_path = '' as $$
  select (p_at at time zone 'Asia/Seoul' - interval '6 hours')::date;
$$;

create function public._session_json(p_session public.study_sessions) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p_session.id, 'userId', p_session.user_id,
    'startedAt', p_session.started_at, 'endedAt', p_session.ended_at);
$$;

create function public._day_record(p_uid uuid, p_date date, p_now timestamptz) returns jsonb
language sql stable set search_path = '' as $$
  with bounds as (
    select (p_date + time '06:00') at time zone 'Asia/Seoul' as lo,
      ((p_date + 1) + time '06:00') at time zone 'Asia/Seoul' as hi
  ), totals as (
    select coalesce(sum(greatest(0, floor(extract(epoch from
      least(s.ended_at, b.hi, p_now) - greatest(s.started_at, b.lo))))) filter (where s.ended_at is not null), 0) as closed,
      coalesce(sum(greatest(0, floor(extract(epoch from
      least(p_now, b.hi) - greatest(s.started_at, b.lo))))) filter (where s.ended_at is null), 0) as running
    from bounds b left join public.study_sessions s on s.user_id = p_uid
      and s.started_at < b.hi and coalesce(s.ended_at, p_now) > b.lo
  )
  select jsonb_build_object('studyDate', p_date, 'closedSeconds', totals.closed,
    'runningSeconds', totals.running,
    'goalMinutes', (select g.weekday_minutes[extract(isodow from p_date)::integer]
      from public.goal_versions g where g.user_id = p_uid and g.effective_date <= p_date
      order by g.effective_date desc limit 1), 'attendance', 'pending')
  from totals;
$$;

create function public.ensure_profile() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_profile public.profiles;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.profiles(id, display_name) values(v_uid, '공부친구-' || left(v_uid::text, 8))
    on conflict (id) do nothing;
  select * into strict v_profile from public.profiles where id = v_uid and room_id = 1;
  return jsonb_build_object('id', v_profile.id, 'displayName', v_profile.display_name);
end;
$$;

create function public.start_study(p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_session public.study_sessions;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'Request ID required' using errcode = '22023'; end if;
  perform 1 from public.profiles where id = v_uid and room_id = 1 for update;
  if not found then raise exception 'Profile required' using errcode = '42501'; end if;
  select s.* into v_session from public.study_start_requests r
    join public.study_sessions s on s.id = r.session_id
    where r.user_id = v_uid and r.request_id = p_request_id;
  if not found then
    select * into v_session from public.study_sessions where user_id = v_uid and ended_at is null;
    if not found then
      insert into public.study_sessions(user_id) values(v_uid) returning * into v_session;
    end if;
    insert into public.study_start_requests(user_id, request_id, session_id) values(v_uid, p_request_id, v_session.id);
  end if;
  return jsonb_build_object('serverNow', clock_timestamp(), 'data', public._session_json(v_session));
end;
$$;

create function public.stop_study(p_session_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_session public.study_sessions;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_session_id is null then raise exception 'Session ID required' using errcode = '22023'; end if;
  perform 1 from public.profiles where id = v_uid and room_id = 1 for update;
  if not found then raise exception 'Profile required' using errcode = '42501'; end if;
  select * into v_session from public.study_sessions where id = p_session_id and user_id = v_uid for update;
  if not found then raise exception 'Session unavailable' using errcode = '42501'; end if;
  if v_session.ended_at is null then
    update public.study_sessions set ended_at = greatest(clock_timestamp(), started_at)
      where id = v_session.id returning * into v_session;
  end if;
  return jsonb_build_object('serverNow', clock_timestamp(), 'data', public._session_json(v_session));
end;
$$;

create function public.get_today() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_now timestamptz := statement_timestamp(); v_profile public.profiles; v_active jsonb;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_profile from public.profiles where id = v_uid and room_id = 1;
  if not found then raise exception 'Profile required' using errcode = '42501'; end if;
  select public._session_json(s) into v_active from public.study_sessions s where s.user_id = v_uid and s.ended_at is null;
  return jsonb_build_object('serverNow', v_now, 'data', jsonb_build_object(
    'profile', jsonb_build_object('id', v_profile.id, 'displayName', v_profile.display_name),
    'day', public._day_record(v_uid, public.study_date(v_now), v_now), 'activeSession', v_active));
end;
$$;

create function public.get_room() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_now timestamptz := statement_timestamp(); v_members jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'profile', jsonb_build_object('id', p.id, 'displayName', p.display_name),
    'today', public._day_record(p.id, public.study_date(v_now), v_now),
    'activeSession', (select public._session_json(s) from public.study_sessions s where s.user_id = p.id and s.ended_at is null)
  ) order by p.created_at, p.id), '[]'::jsonb) into v_members from public.profiles p where p.room_id = 1;
  return jsonb_build_object('serverNow', v_now, 'data', v_members);
end;
$$;

create function public.get_goals() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_goals jsonb;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select to_jsonb(g.weekday_minutes) into v_goals from public.goal_versions g
    where g.user_id = v_uid and g.effective_date <= public.study_date(statement_timestamp())
    order by g.effective_date desc limit 1;
  return coalesce(v_goals, '[null,null,null,null,null,null,null]'::jsonb);
end;
$$;

create function public.get_history(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_now timestamptz := statement_timestamp(); v_uid uuid := auth.uid(); v_days jsonb;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 365 then
    raise exception 'Invalid date range (maximum 366 days)' using errcode = '22023';
  end if;
  select jsonb_agg(public._day_record(v_uid, p_from + d, v_now) order by d desc)
    into v_days from generate_series(0, p_to - p_from) d;
  return jsonb_build_object('serverNow', v_now, 'data', coalesce(v_days, '[]'::jsonb));
end;
$$;

revoke all on function public.study_date(timestamptz), public._session_json(public.study_sessions),
  public._day_record(uuid,date,timestamptz), public.ensure_profile(), public.start_study(uuid),
  public.stop_study(uuid), public.get_today(), public.get_room(), public.get_goals(), public.get_history(date,date)
  from public, anon, authenticated;
grant execute on function public.ensure_profile(), public.start_study(uuid), public.stop_study(uuid),
  public.get_today(), public.get_room(), public.get_goals(), public.get_history(date,date) to authenticated;

alter publication supabase_realtime add table public.study_sessions;
commit;
