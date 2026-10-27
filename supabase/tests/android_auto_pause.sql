-- Execute after the migration, or include its DDL in the same rollback-only transaction.
begin;
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); s uuid := gen_random_uuid(); other uuid := gen_random_uuid();
  started timestamptz := clock_timestamp() - interval '10 minutes'; result jsonb; stop_at timestamptz;
begin
  insert into auth.users(id,aud,role) values(a,'authenticated','authenticated'),(b,'authenticated','authenticated');
  insert into public.profiles(id,room_id,display_name,invite_verified_at,name_confirmed) values(a,0,'guard-test-a',clock_timestamp(),true),(b,1,'guard-test-b',clock_timestamp(),true);
  insert into public.study_sessions(id,user_id,room_id,started_at) values(s,a,0,started),(other,b,1,started);
  perform set_config('request.jwt.claim.sub',a::text,true);
  stop_at := started + interval '2 minutes';
  result := public.stop_study_on_exit(s,stop_at);
  if (result->'data'->>'endedAt')::timestamptz <> stop_at then raise exception 'Departure time not honored'; end if;
  perform public.stop_study_on_exit(s,started + interval '5 minutes');
  if (select ended_at from public.study_sessions where id=s) <> stop_at then raise exception 'Retry added time'; end if;
  perform public.stop_study_on_exit(s,started + interval '1 minute');
  if (select ended_at from public.study_sessions where id=s) <> started + interval '1 minute' then raise exception 'Earliest departure did not win'; end if;
  begin perform public.stop_study_on_exit(other,stop_at); raise exception 'Cross-user/room stop allowed'; exception when insufficient_privilege then null; end;
  begin perform public.stop_study_on_exit(s,'infinity'); raise exception 'Infinite time allowed'; exception when invalid_parameter_value then null; end;
  perform public.stop_study_on_exit(s,started - interval '1 hour');
  if (select ended_at from public.study_sessions where id=s) <> started then raise exception 'Negative duration allowed'; end if;
  perform set_config('request.jwt.claim.sub',b::text,true);
  result := public.stop_study_on_exit(other, clock_timestamp() + interval '1 day');
  if (result->'data'->>'endedAt')::timestamptz > clock_timestamp() then raise exception 'Future duration allowed'; end if;
end;
$$;
rollback;
select 'PASS: departure time, retry idempotency, earliest stop, ownership/room, finite timestamp and duration bounds; all fixtures rolled back' as result;
