-- Run as owner after 200. All fixtures and materialized grants roll back.
begin;
do $$
declare u uuid; other_uid uuid; earned timestamptz; n integer; payload jsonb;
begin
  select p.id into u from public.profiles p join auth.users a on a.id = p.id
    where a.raw_user_meta_data ? 'study_core_test'
      and not exists(select 1 from public.study_sessions s where s.user_id = p.id and s.ended_at is null)
    order by p.created_at desc limit 1;
  select id into other_uid from public.profiles where id <> u limit 1;
  if u is null or other_uid is null then raise exception 'Two existing test profiles required'; end if;
  perform set_config('request.jwt.claim.sub', u::text, true);
  insert into public.goal_versions(user_id,effective_date,weekday_minutes)
    values(u, '2020-01-06', array[1,1,1,1,1,1,1]);
  insert into public.study_sessions(user_id,started_at,ended_at)
    select u, ('2020-01-06'::date + d + time '06:00') at time zone 'Asia/Seoul',
      ('2020-01-06'::date + d + time '06:01') at time zone 'Asia/Seoul'
    from generate_series(0,4) d;
  insert into public.study_sessions(user_id,started_at) values(u,'2020-01-11 06:00+09');
  if public._leave_earned_at(u,'2020-01-06','2020-01-11 06:00:59+09') is not null then
    raise exception 'Sixth day not complete yet'; end if;
  earned := public._leave_earned_at(u,'2020-01-06','2020-01-11 06:01+09');
  if earned is distinct from '2020-01-11 06:01+09'::timestamptz then
    raise exception 'Running sixth goal must qualify at actual crossing time'; end if;
  update public.study_sessions set ended_at = '2020-01-11 06:02+09' where user_id = u and ended_at is null;
  insert into public.study_sessions(user_id,started_at,ended_at)
    values(u,'2020-01-12 06:00+09','2020-01-12 06:01+09');
  perform public.get_leave_status();
  payload := public.get_leave_status();
  select count(*) into n from public.leave_grants where user_id=u and earning_week='2020-01-06';
  if n <> 1 then raise exception 'Retries/seventh day duplicated grant'; end if;
  if not exists(select 1 from public.leave_grants where user_id=u and earning_week='2020-01-06'
    and earned_at='2020-01-11 06:01+09' and expires_at='2020-01-27 06:00+09') then
    raise exception 'Delayed recording changed earning time or expiry'; end if;
  begin
    insert into public.leave_grants(user_id,earning_week,earned_at,expires_at)
      values(u,'2020-01-06','2020-01-11 06:01+09','2020-01-27 06:00+09');
    raise exception 'Duplicate allowed';
  exception when unique_violation then null; end;
  select count(*) into n from public.leave_grants where user_id=u
    and earned_at <= (payload->>'serverNow')::timestamptz and expires_at > (payload->>'serverNow')::timestamptz;
  if (payload->'data'->>'availableCount')::integer <> n then raise exception 'Expired grant counted as available'; end if;
  -- Rest/unset days never count, even when all seven dates have study time.
  insert into public.goal_versions(user_id,effective_date,weekday_minutes)
    values(u,'2020-02-03',array[0,null,1,1,1,1,1]), (u,'2020-02-10',array[1,1,1,1,1,1,1]);
  insert into public.study_sessions(user_id,started_at,ended_at)
    select u, ('2020-02-03'::date+d+time '06:00') at time zone 'Asia/Seoul',
      ('2020-02-03'::date+d+time '06:01') at time zone 'Asia/Seoul' from generate_series(0,6) d;
  if public._leave_earned_at(u,'2020-02-03','2020-02-10 06:00+09') is not null then
    raise exception 'Rest/unset counted as goal completion'; end if;
  -- Six consecutive days spanning two weeks is not a qualifying Mon-Sun week.
  insert into public.study_sessions(user_id,started_at,ended_at)
    select u, ('2020-02-13'::date+d+time '06:00') at time zone 'Asia/Seoul',
      ('2020-02-13'::date+d+time '06:01') at time zone 'Asia/Seoul' from generate_series(0,5) d;
  if public._leave_earned_at(u,'2020-02-10','2020-02-19 06:00+09') is not null
    or public._leave_earned_at(u,'2020-02-17','2020-02-19 06:00+09') is not null then
    raise exception 'Rolling week incorrectly qualified'; end if;
  -- Date clipping and multiple sessions must match existing integer-second totals.
  insert into public.study_sessions(user_id,started_at,ended_at) values
    (u,'2020-03-02 05:59:30+09','2020-03-02 06:00:30+09'),
    (u,'2020-03-02 07:00:00+09','2020-03-02 07:00:30+09');
  if public._goal_completed_at(u,'2020-03-02','2020-03-02 08:00+09')
    is distinct from '2020-03-02 07:00:30+09'::timestamptz then raise exception 'Split-session crossing time incorrect'; end if;
  insert into public.leave_grants(user_id,earning_week,earned_at,expires_at)
    values(other_uid,'2020-01-06','2020-01-11 06:01+09','2020-01-27 06:00+09');
  if has_function_privilege('anon','public.get_leave_status()','execute')
    or has_function_privilege('authenticated','public._leave_earned_at(uuid,date,timestamptz)','execute') then
    raise exception 'Unexpected function access'; end if;
end;
$$;
set local role authenticated;
do $$
begin
  if exists(select 1 from public.leave_grants where user_id <> auth.uid()) then raise exception 'RLS leaked another user'; end if;
  if not exists(select 1 from public.leave_grants where user_id = auth.uid() and earning_week='2020-01-06') then
    raise exception 'Own grant missing'; end if;
  perform public.get_leave_status();
  begin
    update public.leave_grants set expires_at = expires_at + interval '1 day' where user_id = auth.uid();
    raise exception 'Client write allowed';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
set local role anon;
do $$
begin
  begin
    perform public.get_leave_status();
    raise exception 'Unauthenticated RPC allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.leave_grants;
    raise exception 'Unauthenticated table read allowed';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
rollback;
select 'PASS: sixth running goal, actual earning time, weekly dedupe, fixed expiry, own-only RLS, no client writes/anonymous access; rolled back' as result;
