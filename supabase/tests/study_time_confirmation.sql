begin;
do $$
declare u uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); other_s uuid:=gen_random_uuid();
  started timestamptz:='2020-01-06 12:00:00+09'; d date:='2020-01-06'; r jsonb;
begin
  insert into auth.users(id,aud,role) values(u,'authenticated','authenticated'),(other_user,'authenticated','authenticated');
  insert into public.profiles(id,room_id,display_name,invite_verified_at,name_confirmed)
    values(u,1,'time-test',now(),true),(other_user,1,'other-time-test',now(),true);
  insert into public.goal_versions(user_id,effective_date,weekday_minutes) values(u,d,array[180,180,180,180,180,180,180]);
  insert into public.study_sessions(id,user_id,started_at) values(s,u,started),(other_s,other_user,started);
  perform set_config('request.jwt.claim.sub',u::text,true);
  r:=public._day_record(u,d,started+interval '3 hours 1 second');
  if (r->>'confirmedGoalAchieved')::boolean then raise exception 'Unconfirmed running time activated aura'; end if;
  perform public.confirm_study_time(s,started+interval '2 hours 59 minutes 45 seconds');
  r:=public._day_record(u,d,started+interval '3 hours 1 second');
  if (r->>'confirmedGoalAchieved')::boolean then raise exception '15-second deficit accepted'; end if;
  perform public.confirm_study_time(s,started+interval '3 hours');
  r:=public._day_record(u,d,started+interval '3 hours 1 second');
  if not (r->>'confirmedGoalAchieved')::boolean then raise exception 'Confirmed live goal missing'; end if;
  if public._goal_completed_at(u,d,started+interval '3 hours 1 second')<>started+interval '3 hours' then raise exception 'Reward clock differs'; end if;
  perform public.stop_study_on_exit(s,started+interval '2 hours 59 minutes 45 seconds');
  if (select ended_at from public.study_sessions where id=s)<>started+interval '3 hours' then raise exception 'Delayed stop retracted approval'; end if;
  perform public.confirm_study_time(s,started+interval '4 hours');
  if (select ended_at from public.study_sessions where id=s)<>started+interval '3 hours' then raise exception 'Closed session extended'; end if;
  begin perform public.confirm_study_time(other_s,started+interval '3 hours'); raise exception 'Cross-user access'; exception when insufficient_privilege then null; end;
  begin perform public.confirm_study_time(s,'infinity'); raise exception 'Infinite checkpoint'; exception when invalid_parameter_value then null; end;
  begin perform public.confirm_study_time(s,clock_timestamp()+interval '1 day'); raise exception 'Future checkpoint'; exception when invalid_parameter_value then null; end;
  begin perform public.confirm_study_time(s,started-interval '1 second'); raise exception 'Pre-start checkpoint'; exception when invalid_parameter_value then null; end;
end; $$;
rollback;
select 'PASS: approved prefixes, live goal, reward consistency, late stop, closed bound, ownership and invalid timestamps' as result;
