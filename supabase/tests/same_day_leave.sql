-- Fixtures and all operations roll back. Only a marked integration-test user is touched.
begin;
do $$
declare u uuid; d date:=public.study_date(clock_timestamp()); w date; g uuid; r jsonb; rev bigint; request uuid:=gen_random_uuid(); n timestamptz:=clock_timestamp();
begin
 select p.id into u from public.profiles p join auth.users a on a.id=p.id
 where a.raw_user_meta_data ? 'study_core_test' and p.room_id=1 order by p.created_at desc limit 1;
 if u is null then raise exception 'Marked test profile required'; end if;
 update public.profiles set invite_verified_at=coalesce(invite_verified_at,n), name_confirmed=true where id=u;
 perform set_config('request.jwt.claim.sub',u::text,true);
 delete from public.leave_grants where user_id=u;
 delete from public.study_sessions where user_id=u;
 delete from public.goal_versions where user_id=u;
 w:=d-(extract(isodow from d)::integer-1);
 -- The constraint accepts same-day earnings with an approval, independently of reward protection.
 insert into public.leave_grants(user_id,earning_week,earned_at,expires_at,scheduled_date,approved_at)
 values(u,w,n-interval '1 second',((w+21)+time '06:00') at time zone 'Asia/Seoul',d,n);
 delete from public.leave_grants where user_id=u;
 -- Use a previous week's eligible reward; it cannot affect this week's qualification.
 insert into public.leave_grants(user_id,earning_week,earned_at,expires_at)
 values(u,w-7,((w-7)+time '07:00') at time zone 'Asia/Seoul',((w+14)+time '06:00') at time zone 'Asia/Seoul') returning id into g;
 execute 'set local role authenticated';
 r:=public.get_leave_status(); rev:=(r->'data'->>'revision')::bigint;
 r:=public.mutate_leave(request,rev,'schedule',d,null);
 if r->'data'->'grants'->0->>'status'<>'USED' or (r->'data'->>'availableCount')::int<>0 then raise exception 'Today not used immediately'; end if;
 if not exists(select 1 from public.leave_grants where id=g and approved_at is not null and scheduled_date=d) then raise exception 'Approval not stored'; end if;
 r:=public.mutate_leave(request,rev,'schedule',d,null);
 if (r->'data'->>'revision')::bigint<>rev+1 then raise exception 'Replay charged twice'; end if;
 begin perform public.mutate_leave(gen_random_uuid(),rev+1,'cancel',d,g); raise exception 'Used cancellation accepted'; exception when sqlstate '22023' then null; end;
 begin perform public.mutate_leave(gen_random_uuid(),rev+1,'schedule',d+1,g); raise exception 'Used move accepted'; exception when sqlstate '22023' then null; end;
 execute 'reset role';
 if public._day_record(u,d,n)->>'attendance'<>'leave' then raise exception 'Today attendance not leave'; end if;
 -- Future booking can be moved to today atomically; past use must preserve it.
 update public.leave_grants set scheduled_date=null,approved_at=null where id=g;
 r:=public.mutate_leave(gen_random_uuid(),rev+1,'schedule',d+1,g);
 begin perform public.mutate_leave(gen_random_uuid(),rev+2,'schedule',d-1,g); raise exception 'Past accepted'; exception when sqlstate '22023' then null; end;
 if not exists(select 1 from public.leave_grants where id=g and scheduled_date=d+1) then raise exception 'Failed move lost reservation'; end if;
 perform public.mutate_leave(gen_random_uuid(),rev+2,'schedule',d,g);
 -- Existing current-week reward blocks a move to today and preserves its future reservation.
 update public.leave_grants set scheduled_date=d+1 where id=g;
 insert into public.leave_grants(user_id,earning_week,earned_at,expires_at)
 values(u,w,(w+time '06:00') at time zone 'Asia/Seoul',((w+21)+time '06:00') at time zone 'Asia/Seoul');
 begin perform public.mutate_leave(gen_random_uuid(),rev+3,'schedule',d,g); raise exception 'Reward protection bypassed'; exception when sqlstate '22023' then null; end;
 if not exists(select 1 from public.leave_grants where id=g and scheduled_date=d+1) then raise exception 'Protected move lost reservation'; end if;
 -- Deterministic six/seven-day reward protection, independent of the real weekday.
 delete from public.leave_grants where user_id=u;
 insert into public.goal_versions(user_id,effective_date,weekday_minutes) values(u,'2020-04-06',array[1,1,1,1,1,1,1]);
 insert into public.study_sessions(user_id,started_at,ended_at)
 select u,('2020-04-06'::date+i+time '06:00') at time zone 'Asia/Seoul',('2020-04-06'::date+i+time '06:01') at time zone 'Asia/Seoul' from generate_series(0,5) i;
 if not public._leave_today_protected(u,'2020-04-11','2020-04-11 12:00+09') then raise exception 'Unqueried six-day reward not protected'; end if;
 insert into public.leave_grants(user_id,earning_week,earned_at,expires_at,scheduled_date)
 values(u,'2020-04-06','2020-04-11 06:01+09','2020-04-27 06:00+09','2020-04-13');
 if not public._leave_today_protected(u,'2020-04-11','2020-04-11 12:00+09') then raise exception 'Used reward not protected'; end if;
 insert into public.study_sessions(user_id,started_at,ended_at) values(u,'2020-04-12 06:00+09','2020-04-12 06:01+09');
 if public._leave_today_protected(u,'2020-04-12','2020-04-12 12:00+09') then raise exception 'Seventh day incorrectly blocked'; end if;
 if public._leave_today_protected(u,'2020-04-10','2020-04-10 12:00+09') is not true then raise exception 'Existing reward marker ignored'; end if;
 delete from public.leave_grants where user_id=u;
 if public._leave_today_protected(u,'2020-04-10','2020-04-10 12:00+09') then raise exception 'Five days incorrectly blocked'; end if;
 if has_function_privilege('authenticated','public.schedule_leave(uuid,date)','execute') or has_function_privilege('anon','public._leave_today_protected(uuid,date,timestamptz)','execute') or has_function_privilege('authenticated','public._leave_status_before_same_day()','execute') then raise exception 'Private helper exposed'; end if;
end; $$;
rollback;
select 'same-day use, replay, cancel/move rejection, atomic move, attendance and reward protection passed' as result;
