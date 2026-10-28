-- Owner-only integration test. Every fixture, grant and schema trial rolls back.
begin;
do $$
declare u uuid; other_uid uuid; d date:=public.study_date(clock_timestamp()); w date;
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); normal uuid;
 r jsonb; rev bigint; before_rev bigint; existing_reward jsonb; t timestamptz;
begin
 select p.id into u from public.profiles p join auth.users x on x.id=p.id
 where x.raw_user_meta_data ? 'study_core_test' and p.room_id=1 order by p.created_at desc limit 1;
 if u is null then raise exception 'Marked test profile required'; end if;
 select id into other_uid from public.profiles where id<>u limit 1;
 update public.profiles set invite_verified_at=clock_timestamp(),name_confirmed=true where id=u;
 perform set_config('request.jwt.claim.sub',u::text,true);
 delete from public.leave_grants where user_id=u;
 delete from public.study_sessions where user_id=u;
 delete from public.goal_versions where user_id=u;
 w:=d-(extract(isodow from d)::integer-1);
 insert into public.goal_versions(user_id,effective_date,weekday_minutes) values(u,w-14,array[1,1,1,1,1,1,1]);
 insert into public.study_sessions(user_id,started_at,ended_at)
 select u,(w-7+i+time '07:00') at time zone 'Asia/Seoul',(w-7+i+time '07:01') at time zone 'Asia/Seoul'
 from generate_series(0,5) i;
 r:=public.get_leave_status();
 select id,to_jsonb(g) into normal,existing_reward from public.leave_grants g where user_id=u and earning_week=w-7 and kind='reward';
 if normal is null then raise exception 'Reward fixture missing'; end if;
 select leave_revision into before_rev from public.profiles where id=u;
 perform public.admin_apply_leave(a,u,w-7,'private operating reason');
 perform public.admin_apply_leave(b,u,d,null);
 perform public.admin_apply_leave(c,u,d+2,'future');
 select recorded_at into t from public.leave_grants where id=a;
 if t<(d+time '06:00') at time zone 'Asia/Seoul' then raise exception 'Past apply backdated timestamp'; end if;
 if (select leave_revision from public.profiles where id=u)<>before_rev+3 then raise exception 'Revision not advanced'; end if;
 perform public.admin_apply_leave(a,u,w-7,'private operating reason');
 if (select recorded_at from public.leave_grants where id=a)<>t or (select leave_revision from public.profiles where id=u)<>before_rev+3 then
   raise exception 'Retry changed grant or revision'; end if;
 begin perform public.admin_apply_leave(a,u,d-1,'changed'); raise exception 'Changed retry accepted'; exception when sqlstate '22023' then null; end;
 begin perform public.admin_apply_leave(gen_random_uuid(),u,d,null); raise exception 'Occupied date accepted'; exception when sqlstate '22023' then null; end;
 begin perform public.admin_apply_leave(gen_random_uuid(),u,'infinity',null); raise exception 'Infinite date accepted'; exception when sqlstate '22023' then null; end;
 -- Table-level protection survives direct SQL and preserves normal entitlement shape.
 begin
   insert into public.leave_grants(user_id,kind,earned_at) values(u,'admin',clock_timestamp());
   raise exception 'Unapplied admin grant accepted'; exception when check_violation then null;
 end;
 begin
   insert into public.leave_grants(user_id,kind,earned_at) values(u,'free',clock_timestamp());
   raise exception 'Normal NULL week/expiry accepted'; exception when check_violation then null;
 end;
 begin
   update public.leave_grants set scheduled_date=d where id=c;
   raise exception 'Duplicate date accepted'; exception when unique_violation then null;
 end;
 if public._leave_state(d+2,null,(d+2+time '05:59:59') at time zone 'Asia/Seoul')<>'SCHEDULED'
 or public._leave_state(d+2,null,(d+2+time '06:00') at time zone 'Asia/Seoul')<>'USED' then
   raise exception 'Admin 06:00 state transition failed'; end if;
 r:=public._day_record(u,w-7,clock_timestamp());
 if r->>'attendance'<>'leave' or (r->>'closedSeconds')::integer<>60 or not (r->>'goalAchieved')::boolean then
   raise exception 'Attendance overwrote study records'; end if;
 if public._leave_earned_at(u,w-7,clock_timestamp()) is not null then raise exception 'Admin day qualified for reward'; end if;
 perform public.get_leave_status();
 if existing_reward is distinct from (select to_jsonb(g) from public.leave_grants g where id=normal) then
   raise exception 'Existing reward changed after retroactive leave'; end if;
 -- Applying before first reconciliation prevents an unearned reward.
 insert into public.study_sessions(user_id,started_at,ended_at)
 select u,(w-14+i+time '07:00') at time zone 'Asia/Seoul',(w-14+i+time '07:01') at time zone 'Asia/Seoul'
 from generate_series(0,5) i;
 perform public.admin_apply_leave(gen_random_uuid(),u,w-14,null);
 perform public.get_leave_status();
 if exists(select 1 from public.leave_grants where user_id=u and kind='reward' and earning_week=w-14) then
   raise exception 'Reward issued including an admin day'; end if;
 -- Removal restores the original study attendance and can restore reward eligibility.
 delete from public.leave_grants where user_id=u and kind='admin' and scheduled_date=w-14;
 if public._day_record(u,w-14,clock_timestamp())->>'attendance'<>'present' then raise exception 'Attendance not restored'; end if;
 perform public.get_leave_status();
 if not exists(select 1 from public.leave_grants where user_id=u and kind='reward' and earning_week=w-14) then
   raise exception 'Restored qualification did not reconcile'; end if;
 update public.leave_grants set scheduled_date=w-8 where user_id=u and kind='reward' and earning_week=w-14;
 -- Admin SQL changes are versioned too; keep actual creation time.
 select leave_revision into before_rev from public.profiles where id=u;
 update public.leave_grants set scheduled_date=d+3,reason='corrected' where id=c;
 if (select leave_revision from public.profiles where id=u)<>before_rev+1 then raise exception 'Edit did not invalidate'; end if;
 update public.leave_grants set scheduled_date=d+2 where id=c;
 -- Authenticated user can read dates, but not reason or administrator operations.
 execute 'set local role authenticated';
 r:=public.get_leave_status(); rev:=(r->'data'->>'revision')::bigint;
 if (select count(*) from jsonb_array_elements(r->'data'->'grants') g where g->>'kind'='admin')<>3 then raise exception 'Admin grants missing'; end if;
 if exists(select 1 from jsonb_array_elements(r->'data'->'grants') g where g ? 'reason') then raise exception 'RPC leaked reason'; end if;
 if exists(select 1 from jsonb_array_elements(r->'data'->'grants') g where g->>'kind'='admin' and (g->'expiresAt'<>'null'::jsonb or g->'earningWeek'<>'null'::jsonb)) then raise exception 'Admin dates not nullable'; end if;
 begin perform reason from public.leave_grants where id=a; raise exception 'Reason readable directly'; exception when insufficient_privilege then null; end;
 perform id,kind,scheduled_date from public.leave_grants where id=a;
 if exists(select 1 from public.leave_grants where user_id=other_uid) then raise exception 'RLS leaked other user'; end if;
 begin perform public.admin_apply_leave(gen_random_uuid(),u,d+4,null); raise exception 'User issued admin leave'; exception when insufficient_privilege then null; end;
 begin update public.leave_grants set scheduled_date=d+4 where id=c; raise exception 'User wrote directly'; exception when insufficient_privilege then null; end;
 begin
   perform public.mutate_leave(gen_random_uuid(),rev,'cancel',d+2,c);
   raise exception 'User cancelled admin leave';
 exception when sqlstate '22023' then if SQLERRM<>'Admin leave cannot be changed in the app' then raise; end if; end;
 begin
   perform public.mutate_leave(gen_random_uuid(),rev,'schedule',d+3,c);
   raise exception 'User moved admin leave';
 exception when sqlstate '22023' then if SQLERRM<>'Admin leave cannot be changed in the app' then raise; end if; end;
 begin
   perform public.mutate_leave(gen_random_uuid(),rev,'schedule',d+1,c);
   raise exception 'User selected admin grant';
 exception when sqlstate '22023' then if SQLERRM<>'Admin leave cannot be changed in the app' then raise; end if; end;
 begin perform public.mutate_leave(gen_random_uuid(),rev-1,'schedule',d+1); raise exception 'Stale admin revision accepted'; exception when sqlstate '22023' then null; end;
 r:=public.mutate_leave(gen_random_uuid(),rev,'schedule',d+1);
 if not exists(select 1 from public.leave_grants where id=normal and scheduled_date=d+1) then raise exception 'Normal automatic selection broken'; end if;
 r:=public.mutate_leave(gen_random_uuid(),rev+1,'cancel',d+1,normal);
 if not exists(select 1 from public.leave_grants where id=normal and scheduled_date is null) then raise exception 'Normal cancellation broken'; end if;
 execute 'reset role';
 delete from public.leave_grants where id=a;
 select leave_revision into before_rev from public.profiles where id=u;
 perform public.admin_apply_leave(a,u,w-7,'private operating reason');
 if exists(select 1 from public.leave_grants where id=a) or (select leave_revision from public.profiles where id=u)<>before_rev then
   raise exception 'Old apply retry resurrected cancelled admin grant'; end if;
 if has_function_privilege('anon','public.admin_apply_leave(uuid,uuid,date,text)','execute')
 or has_function_privilege('authenticated','public._admin_leave_revision()','execute')
 or has_function_privilege('service_role','public.admin_apply_leave(uuid,uuid,date,text)','execute') then raise exception 'Admin helper exposed'; end if;
end; $$;
rollback;
select 'admin leave integration passed (rolled back)' as result;
