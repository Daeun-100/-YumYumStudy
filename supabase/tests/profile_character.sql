begin;
-- Exercise an existing test-room identity and roll back all edits.
do $$
declare u uuid;
begin
 select id into strict u from public.profiles where room_id=0 and name_confirmed and invite_verified_at is not null limit 1;
 perform set_config('request.jwt.claim.sub',u::text,true);
end $$;
set local role authenticated;
do $$
declare p jsonb; c text;
begin
 foreach c in array array['bunny','bear','cat','puppy','maltese','pomeranian','blackcat'] loop
  p:=public.set_profile('캐릭터검사',c);
  if p->>'character'<>c or p->>'id'<>auth.uid()::text then raise exception 'Save mismatch'; end if;
  if public.ensure_profile(0::smallint)->>'character'<>c then raise exception 'Read mismatch'; end if;
  if public.get_today()->'data'->'profile'->>'character'<>c then raise exception 'Today mismatch'; end if;
  if not exists(select 1 from jsonb_array_elements(public.get_room()->'data') m where m->'profile'->>'id'=auth.uid()::text and m->'profile'->>'character'=c) then raise exception 'Room mismatch'; end if;
 end loop;
 begin
  perform public.set_profile('이름','invalid');
  raise exception 'Invalid character accepted';
 exception when invalid_parameter_value then null;
 end;
 begin
  perform public.set_profile('','bear');
  raise exception 'Invalid name accepted';
 exception when invalid_parameter_value then null;
 end;
 if public.ensure_profile(0::smallint)->>'displayName'<>'캐릭터검사' then raise exception 'Invalid save changed profile'; end if;
end $$;
rollback;
select 'PASS: seven characters, admission/profile/today/room reads, invalid input, rollback' as result;
