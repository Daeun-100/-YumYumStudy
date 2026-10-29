begin;
-- The app and operator now use the same theme/path format. Keep historical rows,
-- grants and old Storage objects, but remove obsolete image-version API paths.
drop function public.get_skin_artwork(text[],smallint,integer);
drop function public.get_event_backgrounds(smallint,integer);
drop function private.read_library_skin_artwork(text[],smallint);
drop function private.room_library_backgrounds(smallint);
create or replace function private.read_skin_artwork(p_ids text[],p_room smallint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actual smallint;
begin
 perform public._require_admission();select room_id into actual from public.profiles where id=auth.uid();
 if actual is distinct from p_room then raise exception 'Room identity mismatch' using errcode='42501';end if;
 if p_ids is null or cardinality(p_ids)>32 then raise exception 'At most 32 skin IDs required' using errcode='22023';end if;
 return coalesce((select jsonb_agg(a.definition order by a.content_id) from private.artwork_library a
 where a.kind='skin' and a.content_id=any(p_ids) and (
  exists(select 1 from public.user_skins u where u.user_id=auth.uid() and u.skin_id=a.content_id)
  or exists(select 1 from public.profiles p where p.room_id=actual and p.invite_verified_at is not null and p.name_confirmed and p.active_skin_id=a.content_id)
 )),'[]'::jsonb);
end $$;
create or replace function private.room_event_backgrounds(p_room smallint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actual smallint;
begin
 perform public._require_admission();select room_id into actual from public.profiles where id=auth.uid();
 if actual is distinct from p_room then raise exception 'Room identity mismatch' using errcode='42501';end if;
 return jsonb_build_object('serverNow',now(),'roomId',actual,'windows',coalesce((
  select jsonb_agg(jsonb_build_object('id',j.id,'startsAt',j.run_at,'endsAt',j.ends_at,'screens',j.screens,'homeAsset',b.home_asset,'focusAsset',b.focus_asset,'artwork',a.definition) order by j.run_at)
  from private.event_jobs j join private.event_backgrounds b on b.id=j.background_id left join private.artwork_library a on a.kind='background' and a.content_id=j.background_id
  where j.room_id=actual and j.kind='set_backgrounds' and j.state not in ('cancelled','superseded') and j.ends_at>now()
   and j.id in (select choice.id from (
    select distinct on (slot.screen,(candidate.run_at<=now())) candidate.id
    from private.event_jobs candidate cross join lateral unnest(candidate.screens) slot(screen)
    where candidate.room_id=actual and candidate.kind='set_backgrounds' and candidate.state not in ('cancelled','superseded') and candidate.ends_at>now()
    order by slot.screen,(candidate.run_at<=now()),candidate.run_at
   ) choice)
 ),'[]'::jsonb));
end $$;
create or replace function private.schedule_event(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n jsonb:=p->'notification'; k text; lim int;
begin
 if n is not null then
  if jsonb_typeof(n)<>'object' or exists(select 1 from jsonb_object_keys(n) key where key not in ('enabled','title','body')) then
   raise exception 'Invalid event notification' using errcode='22023';
  end if;
  if n ? 'enabled' and jsonb_typeof(n->'enabled')<>'boolean' then raise exception 'Notification enabled must be boolean' using errcode='22023';end if;
  foreach k in array array['title','body'] loop
   lim:=case when k='title' then 80 else 160 end;
   if n ? k and (jsonb_typeof(n->k)<>'string' or length(btrim(n->>k)) not between 1 and lim or (n->>k) ~ '[[:cntrl:]]') then
    raise exception 'Invalid notification copy' using errcode='22023';
   end if;
  end loop;
 end if;
 if p ? 'artwork_revision' or p ? 'skin_revisions' then raise exception 'Image revisions are no longer supported; use library asset IDs' using errcode='22023';end if;
 return private.schedule_event_local(p);
end $$;

drop function private.schedule_event_artwork(jsonb);
drop function public.admin_stage_artwork(jsonb);
drop function public.admin_publish_artwork(uuid,boolean);
drop function public.admin_artwork_report(uuid);
drop function private.stage_artwork(jsonb);
drop function private.publish_artwork(uuid,boolean);
drop function private.artwork_report(uuid);
drop function private.validate_artwork_definition(jsonb);
notify pgrst, 'reload schema';
commit;
