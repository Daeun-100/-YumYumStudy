begin;
insert into auth.users(id) values
 ('31000000-0000-4000-8000-000000000001'),('31000000-0000-4000-8000-000000000002'),('31000000-0000-4000-8000-000000000003');
insert into public.profiles(id,room_id,display_name,invite_verified_at,name_confirmed) values
 ('31000000-0000-4000-8000-000000000001',0,'보낸친구',clock_timestamp(),true),
 ('31000000-0000-4000-8000-000000000002',0,'받는친구',clock_timestamp(),true),
 ('31000000-0000-4000-8000-000000000003',1,'다른방',clock_timestamp(),true);
set local role service_role;
do $$
declare a uuid:='31000000-0000-4000-8000-000000000001'; b uuid:='31000000-0000-4000-8000-000000000002'; c uuid:='31000000-0000-4000-8000-000000000003'; rid uuid:=gen_random_uuid(); r jsonb;
begin
 begin perform public.reserve_friend_call(a,0::smallint,c,rid,'같이 공부해요'); raise exception 'Cross room accepted'; exception when insufficient_privilege then null; end;
 begin perform public.reserve_friend_call(a,0::smallint,a,rid,'같이 공부해요'); raise exception 'Self call accepted'; exception when insufficient_privilege then null; end;
 begin perform public.reserve_friend_call(a,1::smallint,b,rid,'같이 공부해요'); raise exception 'Wrong sender room accepted'; exception when insufficient_privilege then null; end;
 begin perform public.reserve_friend_call(a,0::smallint,b,rid,' '); raise exception 'Empty message accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.reserve_friend_call(a,0::smallint,b,rid,repeat('가',41)); raise exception 'Long message accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.reserve_friend_call(a,0::smallint,b,rid,'같이 공부해요'); raise exception 'No devices accepted'; exception when invalid_parameter_value then null; end;
 perform public.register_friend_call_device(b,0::smallint,'test-device','expo','"ExpoPushToken[test-only]"'::jsonb);
 r:=public.reserve_friend_call(a,0::smallint,b,rid,'같이 공부해요');
 if r->>'dispatch'<>'true' or r->'call'->>'title'<>'보낸친구님이 불렀어요!' then raise exception 'Bad first dispatch'; end if;
 r:=public.reserve_friend_call(a,0::smallint,b,rid,'같이 공부해요');
 if r->>'dispatch'<>'false' then raise exception 'Duplicate dispatch'; end if;
 begin perform public.reserve_friend_call(a,0::smallint,b,rid,'다른 메시지'); raise exception 'Changed retry accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.reserve_friend_call(a,0::smallint,b,gen_random_uuid(),'한 번 더'); raise exception 'Cooldown bypass'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
insert into public.study_sessions(user_id,room_id) values('31000000-0000-4000-8000-000000000002',0);
set local role service_role;
do $$ begin
 begin perform public.reserve_friend_call('31000000-0000-4000-8000-000000000001',0::smallint,'31000000-0000-4000-8000-000000000002',gen_random_uuid(),'공부중'); raise exception 'Running friend accepted'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
 begin perform 1 from public.friend_call_devices; raise exception 'Device secrets exposed'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.friend_calls; raise exception 'Messages exposed'; exception when insufficient_privilege then null; end;
 begin perform public.reserve_friend_call('31000000-0000-4000-8000-000000000001',0::smallint,'31000000-0000-4000-8000-000000000002',gen_random_uuid(),'우회'); raise exception 'Direct dispatch allowed'; exception when insufficient_privilege then null; end;
 begin perform public.register_friend_call_device('31000000-0000-4000-8000-000000000002',0::smallint,'hack','expo','"token"'::jsonb); raise exception 'Direct device mutation allowed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: room isolation, auth-only RPCs, private device/message tables, active-session restriction, input validation, cooldown and idempotency; all fixtures rolled back' as result;
