begin;
-- Isolated temporary identity; the entire fixture is rolled back.
insert into auth.users(id) values ('27000000-0000-4000-8000-000000000001');
insert into public.profiles(id,room_id,display_name,invite_verified_at,name_confirmed)
values ('27000000-0000-4000-8000-000000000001',0,'목표검사',clock_timestamp(),true);
select set_config('request.jwt.claim.sub','27000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare r jsonb; s jsonb; d date := (public.get_today()->'data'->'day'->>'studyDate')::date;
begin
 s := public.get_goal_settings()->'data';
 if not (s->>'isFirstSetup')::boolean then raise exception 'First setup not detected'; end if;
 r := public.save_goals(array[60,60,60,60,60,60,60])->'data';
 if (r->>'effectiveDate')::date <> d then raise exception 'First goal was not immediate'; end if;
 s := public.get_goal_settings()->'data';
 if (s->>'isFirstSetup')::boolean or s->'current' <> '[60,60,60,60,60,60,60]'::jsonb or s->'scheduled' <> 'null'::jsonb then raise exception 'Immediate state mismatch'; end if;
 if (public.get_today()->'data'->'day'->>'goalMinutes')::int <> 60 then raise exception 'Today goal mismatch'; end if;
 r := public.save_goals(array[120,120,120,120,120,120,120])->'data';
 if (r->>'effectiveDate')::date <> d+1 then raise exception 'Later edit was not scheduled'; end if;
 s := public.get_goal_settings()->'data';
 if s->'current' <> '[60,60,60,60,60,60,60]'::jsonb or s->'scheduled' <> '[120,120,120,120,120,120,120]'::jsonb then raise exception 'Scheduled state mismatch'; end if;
 perform public.save_goals(array[null,null,null,null,null,null,null]::integer[]);
 if (public.get_goal_settings()->'data'->>'isFirstSetup')::boolean then raise exception 'Clearing goals reset first setup'; end if;
end $$;
rollback;
select 'PASS: initial today, subsequent tomorrow, durable first-setup marker, rollback' as result;
