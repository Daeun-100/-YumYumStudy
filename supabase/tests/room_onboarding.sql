-- Run after 250. All test identities, invite configuration and records roll back.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); d uuid:=gen_random_uuid();
begin
 insert into auth.users(id,is_anonymous) values(a,true),(b,true),(c,true),(d,true);
 perform set_config('test.onboard.a',a::text,true);
 perform set_config('test.onboard.b',b::text,true);
 perform set_config('test.onboard.c',c::text,true);
 perform set_config('test.onboard.d',d::text,true);
 perform set_config('test.onboard.code',encode(extensions.gen_random_bytes(24),'hex'),true);
end; $$;
set local role authenticated;
do $$
declare a uuid:=current_setting('test.onboard.a')::uuid; b uuid:=current_setting('test.onboard.b')::uuid; s jsonb;
begin
 perform set_config('request.jwt.claim.sub',b::text,true);
 if public.get_onboarding(1::smallint)->>'step'<>'invite' then raise exception 'New user did not start at invite'; end if;
 if public.join_room(1::smallint,'anything')->>'error'<>'INVITE_NOT_CONFIGURED' then raise exception 'Unconfigured invite admitted user'; end if;
 begin perform public.ensure_profile(); raise exception 'Legacy RPC bypass'; exception when sqlstate '42501' then null; end;
 begin perform public.get_room(); raise exception 'Room read before admission'; exception when sqlstate '42501' then null; end;
 begin perform public.get_history(current_date,current_date); raise exception 'History before admission'; exception when sqlstate '42501' then null; end;
 begin perform public.get_goals(); raise exception 'Goals before admission'; exception when sqlstate '42501' then null; end;
 begin perform public.set_display_name('우회'); raise exception 'Name bypassed invite'; exception when sqlstate '42501' then null; end;
 if exists(select 1 from public.profiles) or exists(select 1 from public.study_sessions) then raise exception 'RLS exposed room'; end if;
 begin perform code_hash from public.room_invites; raise exception 'Invite hash exposed'; exception when sqlstate '42501' then null; end;
 perform set_config('request.jwt.claim.sub',a::text,true);
 s:=public.join_room(0::smallint,'');
 if s->>'step'<>'name' or public.get_onboarding(0::smallint)->>'step'<>'name' then raise exception 'Test admission/resume failed'; end if;
 begin perform public.get_today(); raise exception 'Study before name'; exception when sqlstate '42501' then null; end;
 begin perform public.set_display_name('             '); raise exception 'Blank name'; exception when sqlstate '22023' then null; end;
 begin perform public.set_display_name(repeat('가',13)); raise exception 'Long name'; exception when sqlstate '22023' then null; end;
 if public.set_display_name(' 같은이름 ')->>'step'<>'ready' then raise exception 'Name completion failed'; end if;
 perform public.ensure_profile(0::smallint);
 perform public.start_study(gen_random_uuid());
 perform public.get_today(); perform public.get_leave_status();
 -- A code-verified profile that has not chosen a name stays out of the member list.
 perform set_config('request.jwt.claim.sub',current_setting('test.onboard.c'),true);
 perform public.join_room(0::smallint,'');
 perform set_config('request.jwt.claim.sub',a::text,true);
 if exists(select 1 from public.profiles where id=current_setting('test.onboard.c')::uuid)
   or exists(select 1 from jsonb_array_elements(public.get_room()->'data') x where x->'profile'->>'id'=current_setting('test.onboard.c')) then raise exception 'Unnamed member visible'; end if;
end; $$;
reset role;
update public.room_invites set code_hash=extensions.crypt(current_setting('test.onboard.code'),extensions.gen_salt('bf',10)) where room_id=1;
set local role authenticated;
do $$
declare b uuid:=current_setting('test.onboard.b')::uuid; c uuid:=current_setting('test.onboard.d')::uuid; i integer; s jsonb;
begin
 perform set_config('request.jwt.claim.sub',b::text,true);
 if public.join_room(1::smallint,'wrong')->>'error'<>'INVALID_INVITE' then raise exception 'Wrong code accepted'; end if;
 s:=public.join_room(1::smallint,current_setting('test.onboard.code'));
 if s->>'step'<>'name' then raise exception 'Valid code rejected'; end if;
 if public.get_onboarding(1::smallint)->>'step'<>'name' then raise exception 'Name resume failed'; end if;
 if public.set_display_name('같은이름')->>'step'<>'ready' then raise exception 'Duplicate names rejected'; end if;
 perform public.ensure_profile();
 if public.get_onboarding(1::smallint)->>'step'<>'ready' then raise exception 'Auto admission failed'; end if;
 if jsonb_array_length(public.get_room()->'data')<1 then raise exception 'Room access failed'; end if;
 begin perform public.join_room(0::smallint,''); raise exception 'Room switch allowed'; exception when sqlstate '42501' then null; end;
 perform public.set_display_name('새이름');
 if public.get_onboarding(1::smallint)->'profile'->>'displayName'<>'새이름' then raise exception 'Rename failed'; end if;
 perform set_config('request.jwt.claim.sub',c::text,true);
 for i in 1..5 loop
  if public.join_room(1::smallint,'wrong')->>'error'<>'INVALID_INVITE' then raise exception 'Unexpected attempt state'; end if;
 end loop;
 if public.join_room(1::smallint,current_setting('test.onboard.code'))->>'error'<>'RATE_LIMITED' then raise exception 'Rate limit failed'; end if;
end; $$;
reset role;
update public.room_invites set code_hash=null where room_id=1;
set local role authenticated;
do $$ begin
 perform set_config('request.jwt.claim.sub',current_setting('test.onboard.b'),true);
 if public.get_onboarding(1::smallint)->>'step'<>'ready' then raise exception 'Code rotation revoked member'; end if;
end; $$;
rollback;
select 'PASS: closed admission, private invite hash, wrong codes, retry limit, step resume, names, room isolation, legacy bypass blocked; rolled back' as result;
