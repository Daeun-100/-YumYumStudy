-- Integration checks leave no users, records, or schema changes behind.
begin;
do $$
declare test_uid uuid:=gen_random_uuid(); live_uid uuid:=gen_random_uuid();
begin
 insert into auth.users(id,is_anonymous) values(test_uid,true),(live_uid,true);
 -- Explicitly admitted fixtures keep this room-isolation test independent of invite configuration.
 insert into public.profiles(id,room_id,display_name,invite_verified_at,name_confirmed)
 values(test_uid,0,'테스트',clock_timestamp(),true),(live_uid,1,'실사용 검사',clock_timestamp(),true);
 perform set_config('test.room_test_uid',test_uid::text,true);
 perform set_config('test.room_live_uid',live_uid::text,true);
end; $$;
set local role authenticated;
do $$
declare test_uid uuid:=current_setting('test.room_test_uid')::uuid;
 live_uid uuid:=current_setting('test.room_live_uid')::uuid;
 test_session uuid; live_session uuid; payload jsonb;
begin
 perform set_config('request.jwt.claim.sub',test_uid::text,true);
 perform public.ensure_profile(0::smallint);
 perform public.ensure_profile(0::smallint);
 if public.current_study_room()<>0 then raise exception 'Wrong test room'; end if;
 payload:=public.start_study(gen_random_uuid());
 test_session:=(payload->'data'->>'id')::uuid;
 if not exists(select 1 from public.study_sessions where id=test_session and room_id=0) then raise exception 'Session routed to live room'; end if;
 perform public.save_goals(array[60,60,60,60,60,60,60]);
 perform public.get_goal_settings();
 perform public.get_today();
 perform public.get_leave_status();
 begin
   perform public.ensure_profile(1::smallint);
   raise exception 'Existing identity was allowed to switch rooms';
 exception when sqlstate '42501' then null; end;
 perform set_config('request.jwt.claim.sub',live_uid::text,true);
 perform public.ensure_profile(); -- Backward compatible production RPC.
 if public.current_study_room()<>1 then raise exception 'Wrong production room'; end if;
 payload:=public.start_study(gen_random_uuid());
 live_session:=(payload->'data'->>'id')::uuid;
 if not exists(select 1 from public.study_sessions where id=live_session and room_id=1) then raise exception 'Live session routed to test room'; end if;
 if exists(select 1 from public.profiles where id=test_uid)
   or exists(select 1 from public.study_sessions where id=test_session)
   or exists(select 1 from public.goal_versions where user_id=test_uid)
   or exists(select 1 from public.study_room where id=0) then raise exception 'Live RLS leaks test data'; end if;
 if exists(select 1 from jsonb_array_elements(public.get_room()->'data') x where x->'profile'->>'id'=test_uid::text) then raise exception 'Live RPC leaks test data'; end if;
 begin
   perform public.stop_study(test_session);
   raise exception 'Cross-room stop accepted';
 exception when sqlstate '42501' then null; end;
 perform public.stop_study(live_session);
 perform set_config('request.jwt.claim.sub',test_uid::text,true);
 if exists(select 1 from public.profiles where room_id=1)
   or exists(select 1 from public.study_sessions where room_id=1)
   or exists(select 1 from public.study_room where id=1) then raise exception 'Test RLS leaks live data'; end if;
 payload:=public.get_room();
 if exists(select 1 from jsonb_array_elements(payload->'data') x where x->'profile'->>'id'=live_uid::text)
   or not exists(select 1 from jsonb_array_elements(payload->'data') x where x->'profile'->>'id'=test_uid::text) then raise exception 'Test room RPC isolation failed'; end if;
 perform public.stop_study(test_session);
end; $$;
rollback;
select 'PASS: room routing, separate profiles, RLS, RPC, goals, leave, legacy clients; rolled back' as result;
