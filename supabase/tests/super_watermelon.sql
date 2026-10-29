begin;
do $$
declare u uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); excluded_uid uuid; w date:='2020-04-06'; n timestamptz:='2020-04-12 06:01+09';
  result jsonb; kind text; tx public.watermelon_transactions; posted_id uuid; before_count int; version text;
begin
  insert into auth.users(id,raw_user_meta_data) values(u,'{"study_core_test":true}'),(other,'{"study_core_test":true}');
  insert into public.profiles(id,display_name,invite_verified_at,name_confirmed)
    values(u,'wallet test',clock_timestamp(),true),(other,'other wallet',clock_timestamp(),true);
  perform set_config('request.jwt.claim.sub',u::text,true);
  select policy_version into version from public.watermelon_reward_policy where id;
  insert into public.goal_versions(user_id,effective_date,weekday_minutes) values(u,w,array[1,1,1,1,1,1,1]);
  insert into public.study_sessions(user_id,started_at,ended_at)
    select u,(w+d+time '06:00') at time zone 'Asia/Seoul',(w+d+time '06:01') at time zone 'Asia/Seoul' from generate_series(0,5) d;
  if public._super_watermelon_earned_at(u,w,n) is not null then raise exception 'Six days earned gold'; end if;
  if not public._leave_today_protected(u,w+5,n) then raise exception 'Six-day leave protection regressed'; end if;
  insert into public.study_sessions(user_id,started_at) values(u,(w+6+time '06:00') at time zone 'Asia/Seoul');
  if public._super_watermelon_earned_at(u,w,n-interval '1 second') is not null then raise exception 'Early gold'; end if;
  if public._super_watermelon_earned_at(u,w,n) is distinct from n then raise exception 'Running completion missing'; end if;
  if not public._leave_today_protected(u,w+6,n) then raise exception 'Unqueried Sunday not protected'; end if;
  update public.study_sessions set ended_at=n where user_id=u and ended_at is null;
  -- No retroactive currency before the persisted launch date. Display still works.
  update public.watermelon_reward_policy set starts_on=w+7 where id;
  result:=public.get_history(w,w+6);
  if exists(select 1 from public.watermelon_transactions where user_id=u) then raise exception 'Prelaunch currency awarded'; end if;
  if not (public._day_record(u,w+6,n)->>'superWatermelon')::boolean then raise exception 'Prelaunch display lost'; end if;
  result:=public.get_watermelon_balance();
  if result->'data'<>'{"normalBalance":0,"superBalance":0}'::jsonb then raise exception 'Missing wallet must read zero'; end if;
  if exists(select 1 from public.watermelon_balances where user_id=u) then raise exception 'Balance read performed a write'; end if;
  -- Query only Sunday, then the full week twice. Never award normal plus super.
  update public.watermelon_reward_policy set starts_on=w where id;
  execute 'set local role authenticated';
  result:=public.get_history(w+6,w+6);
  if jsonb_array_length(result->'data')<>1 or not (result->'data'->0->>'superWatermelon')::boolean then raise exception 'Partial window failed'; end if;
  result:=public.get_history(w,w+6);
  result:=public.get_history(w,w+6);
  result:=public.get_watermelon_balance();
  execute 'reset role';
  if result->'data'<>'{"normalBalance":6,"superBalance":1}'::jsonb then raise exception 'Wrong seven-day balance'; end if;
  if (select count(*) from public.watermelon_transactions where user_id=u)<>7 then raise exception 'Duplicate daily awards'; end if;
  select * into tx from public.watermelon_transactions where user_id=u and source_type='daily_goal' and source_key=(w+6)::text;
  if tx.currency<>'super' or tx.amount<>1 or tx.occurred_at<>n then raise exception 'Sunday payload incorrect'; end if;
  posted_id:=public._post_watermelon_transaction(u,tx.currency,tx.amount,tx.transaction_type,tx.source_type,tx.source_key,tx.study_date,tx.achievement_id,tx.policy_version,tx.occurred_at);
  if posted_id<>tx.id then raise exception 'Retry changed transaction'; end if;
  begin
    perform public._post_watermelon_transaction(u,'normal',1,'grant','daily_goal',(w+6)::text,w+6,null,version,n);
    raise exception 'Normal and super both granted';
  exception when sqlstate '22023' then null; end;
  -- Private posting primitive supports future independent achievement source keys.
  posted_id:=public._post_watermelon_transaction(u,'normal',3,'grant','achievement','weekly-six-days:'||w,null,'weekly-six-days','achievement-v1',n);
  perform public._post_watermelon_transaction(u,'normal',3,'grant','achievement','weekly-six-days:'||w,null,'weekly-six-days','achievement-v1',n);
  if (select normal_balance from public.watermelon_balances where user_id=u)<>9 then raise exception 'Achievement duplicated or daily reward lost'; end if;
  -- A failed debit rolls back its inserted transaction as well as the balance.
  select count(*) into before_count from public.watermelon_transactions where user_id=u;
  begin
    perform public._post_watermelon_transaction(u,'normal',-10,'spend','purchase','overspend',null,null,'test-v1',n);
    raise exception 'Overspend accepted';
  exception when sqlstate '22023' then null; end;
  if (select count(*) from public.watermelon_transactions where user_id=u)<>before_count
    or (select normal_balance from public.watermelon_balances where user_id=u)<>9 then raise exception 'Failed debit left partial state'; end if;
  begin
    update public.watermelon_transactions set amount=2 where id=tx.id;
    raise exception 'Ledger update allowed';
  exception when sqlstate '22023' then null; end;
  begin
    delete from public.watermelon_transactions where id=tx.id;
    raise exception 'Ledger deletion allowed';
  exception when sqlstate '22023' then null; end;
  -- Admin changes recalculate display, but never rewrite credited currency.
  perform public.admin_apply_leave(gen_random_uuid(),u,w+1,'test');
  if (public._day_record(u,w+6,n)->>'superWatermelon')::boolean then raise exception 'Display coupled to wallet'; end if;
  result:=public.get_history(w,w+6);
  if (select super_balance from public.watermelon_balances where user_id=u)<>1 then raise exception 'Admin auto-reclaimed currency'; end if;
  delete from public.leave_grants where user_id=u;
  foreach kind in array array['free','reward','admin'] loop
    if kind='admin' then perform public.admin_apply_leave(gen_random_uuid(),u,w+1,'test');
    else insert into public.leave_grants(user_id,kind,earning_week,earned_at,expires_at,scheduled_date)
      values(u,kind,w,(w+time '06:00') at time zone 'Asia/Seoul',
        (w+case when kind='free' then 7 else 21 end+time '06:00') at time zone 'Asia/Seoul',w+1); end if;
    if public._super_watermelon_earned_at(u,w,n) is not null then raise exception 'Leave kind % counted',kind; end if;
    delete from public.leave_grants where user_id=u;
  end loop;
  update public.goal_versions set weekday_minutes=array[1,0,1,1,1,1,1] where user_id=u;
  if public._super_watermelon_earned_at(u,w,n) is not null then raise exception 'Rest counted'; end if;
  update public.goal_versions set weekday_minutes=array[1,null,1,1,1,1,1] where user_id=u;
  if public._super_watermelon_earned_at(u,w,n) is not null then raise exception 'Unset counted'; end if;
  update public.goal_versions set weekday_minutes=array[1,2,1,1,1,1,1] where user_id=u;
  if public._super_watermelon_earned_at(u,w,n) is not null then raise exception 'Partial counted'; end if;
  update public.goal_versions set weekday_minutes=array[1,1,1,1,1,1,1] where user_id=u;
  if public._super_watermelon_earned_at(u,w,'2020-04-12 05:59:59+09') is not null then raise exception '06:00 boundary failed'; end if;
  -- Month boundary: April 5 query must inspect the March 30 goals/sessions too.
  insert into public.goal_versions(user_id,effective_date,weekday_minutes) values(other,'2020-03-30',array[1,1,1,1,1,1,1]);
  insert into public.study_sessions(user_id,started_at,ended_at)
    select other,('2020-03-30'::date+d+time '06:00') at time zone 'Asia/Seoul',('2020-03-30'::date+d+time '06:01') at time zone 'Asia/Seoul' from generate_series(0,6) d;
  update public.watermelon_reward_policy set starts_on='2020-03-30' where id;
  execute 'set local role authenticated';
  result:=public.get_member_history(other,'2020-04-05','2020-04-05');
  execute 'reset role';
  if not (result->'data'->0->>'superWatermelon')::boolean then raise exception 'Month boundary failed'; end if;
  if (select super_balance from public.watermelon_balances where user_id=other)<>1 then raise exception 'Member reward not reconciled'; end if;
  -- Own-wallet API accepts no arbitrary user ID and does not leak another wallet.
  perform set_config('request.jwt.claim.sub',other::text,true);
  result:=public.get_watermelon_balance();
  if result->'data'<>'{"normalBalance":0,"superBalance":1}'::jsonb then raise exception 'Wallet isolation failed'; end if;
  -- These are new users with no earlier transactions: ordinary daily grants must
  -- also exclude leave/rest/unset/partial, not just the seven-day gold predicate.
  foreach kind in array array['free','reward','admin','rest','unset','partial'] loop
    excluded_uid:=gen_random_uuid();
    insert into auth.users(id) values(excluded_uid);
    insert into public.profiles(id,display_name,invite_verified_at,name_confirmed) values(excluded_uid,'excluded',now(),true);
    insert into public.goal_versions(user_id,effective_date,weekday_minutes)
      values(excluded_uid,w,array[case when kind='rest' then 0 when kind='unset' then null when kind='partial' then 2 else 1 end,1,1,1,1,1,1]);
    insert into public.study_sessions(user_id,started_at,ended_at)
      values(excluded_uid,(w+time '06:00') at time zone 'Asia/Seoul',(w+time '06:01') at time zone 'Asia/Seoul');
    if kind='admin' then perform public.admin_apply_leave(gen_random_uuid(),excluded_uid,w,'test');
    elsif kind in ('free','reward') then
      insert into public.leave_grants(user_id,kind,earning_week,earned_at,expires_at,scheduled_date)
      values(excluded_uid,kind,w,(w+time '06:00') at time zone 'Asia/Seoul',
        (w+case when kind='free' then 7 else 21 end+time '06:00') at time zone 'Asia/Seoul',w);
    end if;
    perform public._reconcile_watermelons(excluded_uid,w,w+6,n);
    if exists(select 1 from public.watermelon_transactions where user_id=excluded_uid) then raise exception 'Ineligible daily reward: %',kind; end if;
  end loop;
  -- Ledger sums remain the independent recovery source for every wallet row.
  if exists(select 1 from public.watermelon_balances b where b.user_id in (u,other) and (
    b.normal_balance<>(select coalesce(sum(t.amount),0) from public.watermelon_transactions t where t.user_id=b.user_id and t.currency='normal')
    or b.super_balance<>(select coalesce(sum(t.amount),0) from public.watermelon_transactions t where t.user_id=b.user_id and t.currency='super'))) then raise exception 'Balance drift'; end if;
  if has_table_privilege('authenticated','public.watermelon_transactions','insert')
    or has_table_privilege('authenticated','public.watermelon_balances','select')
    or has_table_privilege('authenticated','public.watermelon_reward_policy','update')
    or has_function_privilege('authenticated','public._post_watermelon_transaction(uuid,text,bigint,text,text,text,date,text,text,timestamptz,uuid)','execute')
    or has_function_privilege('anon','public.get_watermelon_balance()','execute') then raise exception 'Private wallet access exposed'; end if;
  update public.profiles set name_confirmed=false where id=other;
  begin perform public.get_watermelon_balance(); raise exception 'Admission bypass'; exception when sqlstate '42501' then null; end;
end; $$;
rollback;
select 'watermelon transactions, balances, policy, presentation and protection passed' as result;
