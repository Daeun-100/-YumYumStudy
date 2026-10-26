begin;
do $$
declare u uuid;
begin
 select id into strict u from public.profiles where room_id=0 and name_confirmed and invite_verified_at is not null limit 1;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('friend_test.today',public.study_date(statement_timestamp())::text,true);
 perform set_config('friend_test.other_room',coalesce((select id::text from public.profiles where room_id=1 limit 1),''),true);
 perform set_config('friend_test.peer',coalesce((select id::text from public.profiles where room_id=0 and id<>u and name_confirmed and invite_verified_at is not null limit 1),u::text),true);
end $$;
set local role authenticated;
do $$
declare r jsonb; d date:=current_setting('friend_test.today')::date;
begin
 r:=public.get_member_history(auth.uid(),d,d);
 if jsonb_array_length(r->'data')<>1 or r->'data'->0->>'studyDate'<>d::text then raise exception 'Self history mismatch'; end if;
 r:=public.get_member_history(current_setting('friend_test.peer')::uuid,d-6,d);
 if jsonb_array_length(r->'data')<>7 then raise exception 'Peer history mismatch'; end if;
 begin
  perform public.get_member_history('00000000-0000-0000-0000-000000000000',d,d);
  raise exception 'Nonmember accepted';
 exception when insufficient_privilege then null;
 end;
 if current_setting('friend_test.other_room')<>'' then
  begin
   perform public.get_member_history(current_setting('friend_test.other_room')::uuid,d,d);
   raise exception 'Cross-room accepted';
  exception when insufficient_privilege then null;
  end;
 end if;
 begin
  perform public.get_member_history(auth.uid(),d-366,d);
  raise exception 'Oversized range accepted';
 exception when invalid_parameter_value then null;
 end;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.get_member_history(current_setting('friend_test.peer')::uuid,d,d);
  raise exception 'Unauthenticated accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
select 'PASS: self, peer, nonmember, cross-room, range, unauthenticated; rolled back' as result;
