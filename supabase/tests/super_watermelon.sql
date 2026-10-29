begin;
do $$
declare u uuid:=gen_random_uuid(); w date:='2020-04-06'; n timestamptz:='2020-04-12 06:01+09';
  result jsonb; item jsonb; kind text; count_awards int;
begin
  insert into auth.users(id,raw_user_meta_data) values(u,'{"study_core_test":true}');
  insert into public.profiles(id,display_name,invite_verified_at,name_confirmed) values(u,'gold test',clock_timestamp(),true);
  perform set_config('request.jwt.claim.sub',u::text,true);
  insert into public.goal_versions(user_id,effective_date,weekday_minutes) values(u,w,array[1,1,1,1,1,1,1]);
  insert into public.study_sessions(user_id,started_at,ended_at)
    select u,(w+d+time '06:00') at time zone 'Asia/Seoul',(w+d+time '06:01') at time zone 'Asia/Seoul' from generate_series(0,5) d;
  if public._super_watermelon_earned_at(u,w,n) is not null then raise exception 'Six days earned gold'; end if;
  if not public._leave_today_protected(u,w+5,n) then raise exception 'Six-day leave protection regressed'; end if;
  insert into public.study_sessions(user_id,started_at) values(u,(w+6+time '06:00') at time zone 'Asia/Seoul');
  if public._super_watermelon_earned_at(u,w,n-interval '1 second') is not null then raise exception 'Early gold'; end if;
  if public._super_watermelon_earned_at(u,w,n) is distinct from n then raise exception 'Running session completion missing'; end if;
  if not public._leave_today_protected(u,w+6,n) then raise exception 'Unqueried Sunday gold not protected'; end if;
  if (public._day_record(u,w+5,n)->>'superWatermelon')::boolean then raise exception 'Saturday gold'; end if;
  if not (public._day_record(u,w+6,n)->>'superWatermelon')::boolean then raise exception 'Sunday not gold'; end if;
  update public.study_sessions set ended_at=n where user_id=u and ended_at is null;
  -- A one-date window still inspects Monday through Sunday. Exercise real RPC/ACL.
  execute 'set local role authenticated';
  result:=public.get_history(w+6,w+6);
  result:=public.get_history(w+6,w+6);
  execute 'reset role';
  if jsonb_array_length(result->'data')<>1 or not (result->'data'->0->>'superWatermelon')::boolean then raise exception 'Partial window failed'; end if;
  select count(*) into count_awards from public.super_watermelon_awards where user_id=u;
  if count_awards<>1 then raise exception 'Duplicate award'; end if;
  if (select earned_at from public.super_watermelon_awards where user_id=u) is distinct from n then raise exception 'Recovery changed earning time'; end if;
  -- Admin overrides retain an already materialized award.
  perform public.admin_apply_leave(gen_random_uuid(),u,w+1,'test');
  if not (public._day_record(u,w+6,n)->>'superWatermelon')::boolean then raise exception 'Admin revoked awarded gold'; end if;
  delete from public.leave_grants where user_id=u;
  delete from public.super_watermelon_awards where user_id=u;
  -- Every leave kind excludes an otherwise fully achieved week before award.
  foreach kind in array array['free','reward','admin'] loop
    if kind='admin' then
      perform public.admin_apply_leave(gen_random_uuid(),u,w+1,'test');
    else
      insert into public.leave_grants(user_id,kind,earning_week,earned_at,expires_at,scheduled_date)
        values(u,kind,w,(w+time '06:00') at time zone 'Asia/Seoul',
          (w+case when kind='free' then 7 else 21 end+time '06:00') at time zone 'Asia/Seoul',w+1);
    end if;
    if public._super_watermelon_earned_at(u,w,n) is not null then raise exception 'Leave kind % counted',kind; end if;
    delete from public.leave_grants where user_id=u;
  end loop;
  -- Rest, unset and partial goals cannot be completed days.
  update public.goal_versions set weekday_minutes=array[1,0,1,1,1,1,1] where user_id=u;
  if public._super_watermelon_earned_at(u,w,n) is not null then raise exception 'Rest counted'; end if;
  update public.goal_versions set weekday_minutes=array[1,null,1,1,1,1,1] where user_id=u;
  if public._super_watermelon_earned_at(u,w,n) is not null then raise exception 'Unset counted'; end if;
  update public.goal_versions set weekday_minutes=array[1,2,1,1,1,1,1] where user_id=u;
  if public._super_watermelon_earned_at(u,w,n) is not null then raise exception 'Partial counted'; end if;
  update public.goal_versions set weekday_minutes=array[1,1,1,1,1,1,1] where user_id=u;
  if public._super_watermelon_earned_at(u,w,'2020-04-12 05:59:59+09') is not null then raise exception '06:00 boundary failed'; end if;
  if public._super_watermelon_earned_at(u,w+1,n) is not null then raise exception 'Non-Monday week accepted'; end if;
  if has_table_privilege('authenticated','public.super_watermelon_awards','insert')
    or has_table_privilege('authenticated','public.super_watermelon_awards','select')
    or has_function_privilege('anon','public._super_watermelon_earned_at(uuid,date,timestamptz)','execute')
    or has_function_privilege('authenticated','public._reconcile_super_watermelons(uuid,date,date,timestamptz)','execute')
    or has_function_privilege('authenticated','public._today_before_super_watermelon()','execute') then raise exception 'Private award API exposed'; end if;
  -- Authenticated users cannot query another room through the owning RPC.
  update public.profiles set name_confirmed=false where id=u;
  begin perform public.get_history(w,w+6); raise exception 'Admission bypass'; exception when sqlstate '42501' then null; end;
end; $$;
rollback;
select 'super watermelon integration checks passed' as result;
