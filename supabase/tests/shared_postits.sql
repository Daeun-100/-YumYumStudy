begin;
insert into auth.users(id) values ('30000000-0000-4000-8000-000000000001'),('30000000-0000-4000-8000-000000000002'),('30000000-0000-4000-8000-000000000003');
insert into public.profiles(id,room_id,display_name,invite_verified_at,name_confirmed) values
 ('30000000-0000-4000-8000-000000000001',0,'작성자',clock_timestamp(),true),
 ('30000000-0000-4000-8000-000000000002',0,'친구',clock_timestamp(),true),
 ('30000000-0000-4000-8000-000000000003',1,'다른방',clock_timestamp(),true);
-- Past notes must not be included in today's list.
insert into public.room_postits(id,room_id,author_id,author,text,color,x,y,study_date)
values ('30000000-0000-4000-8000-000000000010',0,'30000000-0000-4000-8000-000000000001','작성자','어제','#F9E8A0',.3,.4,public.study_date(statement_timestamp())-1);
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare r jsonb;
begin
 r:=public.put_room_postit('30000000-0000-4000-8000-000000000011','같이 힘내자','#F9E8A0',.3,.4);
 if r->>'author'<>'작성자' then raise exception 'Author mismatch'; end if;
 perform public.put_room_postit('30000000-0000-4000-8000-000000000011','같이 힘내자','#F9E8A0',.3,.4);
 if not exists(select 1 from jsonb_array_elements(public.get_room_postits()->'notes') n where n->>'id'='30000000-0000-4000-8000-000000000011') then raise exception 'Missing note'; end if;
 if exists(select 1 from jsonb_array_elements(public.get_room_postits()->'notes') n where n->>'id'='30000000-0000-4000-8000-000000000010') then raise exception 'Past note visible'; end if;
 begin
  perform public.put_room_postit(gen_random_uuid(),' ','#F9E8A0',.3,.4);
  raise exception 'Empty note accepted';
 exception when check_violation then null; end;
 begin
  perform public.put_room_postit(gen_random_uuid(),'내용','#F9E8A0',2,.4);
  raise exception 'Invalid position accepted';
 exception when check_violation then null; end;
 begin
  perform 1 from public.room_postits;
  raise exception 'Direct table access allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000003',true);
do $$ begin
 begin
  perform public.delete_room_postit('30000000-0000-4000-8000-000000000011');
  raise exception 'Cross-room deletion allowed';
 exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
do $$ begin
 if public.delete_room_postit('30000000-0000-4000-8000-000000000011')->>'deleted_at' is null then raise exception 'Friend could not delete'; end if;
 if exists(select 1 from jsonb_array_elements(public.get_room_postits()->'notes') n where n->>'id'='30000000-0000-4000-8000-000000000011') then raise exception 'Deleted note visible'; end if;
end $$;
rollback;
select 'PASS: today-only, validated input, retry, room isolation, friend deletion, table restrictions; rolled back' as result;
