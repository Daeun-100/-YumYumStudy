begin;
do $$
declare u uuid; g uuid; g1 uuid; g2 uuid; d date := public.study_date(clock_timestamp()); w date; r jsonb;
begin
 select p.id into u from public.profiles p join auth.users a on a.id=p.id where a.raw_user_meta_data ? 'study_core_test' and p.room_id=1 order by p.created_at desc limit 1;
 if u is null then raise exception 'Test profile required'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 insert into public.goal_versions(user_id,effective_date,weekday_minutes) values(u,'2020-04-06',array[1,1,1,1,1,1,1]);
 insert into public.study_sessions(user_id,started_at,ended_at)
 select u,('2020-04-06'::date+i+time '06:00') at time zone 'Asia/Seoul',('2020-04-06'::date+i+time '06:01') at time zone 'Asia/Seoul' from generate_series(0,5) i;
 insert into public.leave_grants(user_id,earning_week,earned_at,expires_at,scheduled_date)
 values(u,'2020-03-30','2020-04-04 06:00+09','2020-04-20 06:00+09','2020-04-11') returning id into g;
 if public._day_record(u,'2020-04-11','2020-04-11 05:59:59+09')->>'attendance'<>'pending' then raise exception 'Future leave applied early'; end if;
 if public._day_record(u,'2020-04-11','2020-04-11 06:00+09')->>'attendance'<>'leave' then raise exception 'Leave not applied at 06:00'; end if;
 r:=public._day_record(u,'2020-04-11','2020-04-12 06:00+09');
 if r->>'attendance'<>'leave' or (r->>'closedSeconds')::integer<>60 or not (r->>'goalAchieved')::boolean then raise exception 'Study data lost on leave day'; end if;
 if public._leave_earned_at(u,'2020-04-06','2020-04-12 06:00+09') is not null then raise exception 'Leave counted toward six days'; end if;
 -- Simulate a booking cancelled before use; historical fixtures are rolled back.
 update public.leave_grants set scheduled_date=null where id=g;
 if public._leave_earned_at(u,'2020-04-06','2020-04-12 06:00+09') is distinct from '2020-04-11 06:01+09'::timestamptz then raise exception 'Cancelled leave still excluded'; end if;
 update public.leave_grants set scheduled_date='2020-04-11' where id=g;
 insert into public.study_sessions(user_id,started_at,ended_at) values(u,'2020-04-12 06:00+09','2020-04-12 06:01+09');
 if public._leave_earned_at(u,'2020-04-06','2020-04-13 06:00+09') is distinct from '2020-04-12 06:01+09'::timestamptz then raise exception 'Six non-leave days did not earn'; end if;
 w:=d-(extract(isodow from d)::integer-1);
 insert into public.leave_grants(user_id,earning_week,earned_at,expires_at) values(u,w,(w+time '06:00') at time zone 'Asia/Seoul',((w+21)+time '06:00') at time zone 'Asia/Seoul') on conflict(user_id,earning_week,kind) do update set scheduled_date=null returning id into g1;
 insert into public.leave_grants(user_id,earning_week,earned_at,expires_at) values(u,w-7,((w-7)+time '06:00') at time zone 'Asia/Seoul',((w+14)+time '06:00') at time zone 'Asia/Seoul') on conflict(user_id,earning_week,kind) do update set scheduled_date=null returning id into g2;
 perform public.schedule_leave(g1,d+1);
 perform public.schedule_leave(g1,d+1);
 begin perform public.schedule_leave(g2,d+1); raise exception 'Same-day duplicate accepted'; exception when sqlstate '22023' then null; end;
 begin update public.leave_grants set scheduled_date=d+1 where id=g2; raise exception 'Unique index failed'; exception when unique_violation then null; end;
 perform public.cancel_leave(g1,d+1);
 perform public.schedule_leave(g2,d+1);
 if (select count(*) from public.leave_grants where user_id=u and scheduled_date=d+1)<>1 then raise exception 'Cancel/rebook count failed'; end if;
end; $$;
rollback;
select 'leave attendance, six-day exclusion, cancellation, one-per-day and unique constraint passed' as result;
