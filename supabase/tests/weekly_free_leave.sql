-- All simulated grants roll back. Never awards this week's free leave.
begin;
do $$
declare u uuid; n integer; before_reward jsonb; after_reward jsonb;
begin
  select id into u from public.profiles where invite_verified_at is not null and name_confirmed order by id limit 1;
  if u is null then raise exception 'Admitted profile required'; end if;
  select jsonb_agg(to_jsonb(g) order by id) into before_reward from public.leave_grants g where kind='reward';
  perform public._grant_weekly_free_leave('2026-11-02 05:59:59+09',u);
  if exists(select 1 from public.leave_grants where kind='free') then raise exception 'Premature/this-week free grant'; end if;
  perform public._grant_weekly_free_leave('2026-11-02 06:00+09',u);
  perform public._grant_weekly_free_leave('2026-11-02 06:00+09',u);
  select count(*) into n from public.leave_grants where user_id=u and earning_week='2026-11-02' and kind='free'
    and earned_at='2026-11-02 06:00+09' and expires_at='2026-11-09 06:00+09';
  if n<>1 then raise exception 'Weekly grant/duplicate guard failed'; end if;
  if public._leave_state(null,'2026-11-09 06:00+09','2026-11-09 05:59:59+09')<>'AVAILABLE'
    or public._leave_state(null,'2026-11-09 06:00+09','2026-11-09 06:00+09')<>'EXPIRED' then
    raise exception 'Free expiry boundary failed'; end if;
  -- Same user/week may also earn a reward, retaining the 21-day lifetime.
  insert into public.leave_grants(user_id,earning_week,kind,earned_at,expires_at)
  values(u,'2026-11-02','reward','2026-11-07 06:00+09','2026-11-23 06:00+09');
  if public._leave_state(null,'2026-11-23 06:00+09','2026-11-09 06:00+09')<>'AVAILABLE' then
    raise exception 'Reward expired with free leave'; end if;
  -- A free grant cannot be reserved on or after the following Monday.
  begin
    update public.leave_grants set scheduled_date='2026-11-09' where user_id=u and kind='free' and earning_week='2026-11-02';
    raise exception 'Invalid reservation accepted';
  exception when check_violation then null; end;
  perform public._grant_weekly_free_leave('2026-11-09 06:00+09',u);
  if (select count(*) from public.leave_grants where user_id=u and kind='free')<>2 then
    raise exception 'Next weekly grant missing'; end if;
  -- Compare the pre-existing reward rows only.
  select jsonb_agg(to_jsonb(g) order by id) into after_reward from public.leave_grants g where kind='reward' and earning_week<>'2026-11-02';
  if before_reward is distinct from after_reward then raise exception 'Existing rewards changed'; end if;
  if has_function_privilege('authenticated','public._grant_weekly_free_leave(timestamptz,uuid)','execute')
    or has_function_privilege('anon','public._grant_weekly_free_leave(timestamptz,uuid)','execute') then
    raise exception 'Internal grant function exposed'; end if;
end; $$;
rollback;
