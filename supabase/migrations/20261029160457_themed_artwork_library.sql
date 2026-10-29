begin;
-- Reusable theme assets are independent of events and have no image revision UUID.
create table private.artwork_library (
 kind text not null check(kind in ('skin','background')),
 content_id text not null,
 theme text not null check(theme ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
 definition jsonb not null,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(kind,content_id)
);
create index artwork_library_theme_idx on private.artwork_library(theme,kind);
alter table private.artwork_library enable row level security;
revoke all on private.artwork_library from public,anon,authenticated,service_role;

create function private.validate_library_artwork(m jsonb) returns void
language plpgsql set search_path='' as $$
declare screen text; a jsonb; e jsonb; pos jsonb; k text; w int; h int; nm text; n numeric;
begin
 if jsonb_typeof(m) is distinct from 'object' or m->'schemaVersion' is distinct from '2'::jsonb or m->>'kind' is null or m->>'kind' not in ('skin','background')
  or jsonb_typeof(m->'id') is distinct from 'string' or jsonb_typeof(m->'name') is distinct from 'string'
  or coalesce(m->>'id','') !~ '^[a-z0-9][a-z0-9_-]{0,79}$' or coalesce(length(btrim(m->>'name')),0) not between 1 and 60 then raise exception 'Invalid artwork definition' using errcode='22023'; end if;
 if m->>'kind'='background' and m->>'id' !~ '^[a-z0-9][a-z0-9-]{0,79}$' then raise exception 'Invalid background ID' using errcode='22023';end if;
 if m ? 'revision' or jsonb_typeof(m->'theme') is distinct from 'string' or coalesce(m->>'theme','') !~ '^[a-z0-9][a-z0-9_-]{0,79}$' then raise exception 'Theme required; image revision is not used' using errcode='22023';end if;
 if m->>'kind'='skin' and (m->>'character' is null or m->>'character' not in ('bunny','bear','cat','puppy','maltese','pomeranian','blackcat')) then raise exception 'Invalid character' using errcode='22023';end if;
 foreach screen in array array['home','focus'] loop
  a:=m->screen;
  w:=case when screen='home' then 1536 when m->>'kind'='skin' then 1254 else 1024 end;
  h:=case when screen='home' then 1024 when m->>'kind'='skin' then 1254 else 1536 end;
  if jsonb_typeof(a) is distinct from 'object' or jsonb_typeof(a->'path') is distinct from 'string' or jsonb_typeof(a->'sha256') is distinct from 'string'
   or jsonb_typeof(a->'width') is distinct from 'number' or jsonb_typeof(a->'height') is distinct from 'number' or jsonb_typeof(a->'bytes') is distinct from 'number' or (length(a->>'path')>240 or a->>'path' !~ ('^'||(m->>'theme')||case when m->>'kind'='skin' then '/skins/' else '/backgrounds/' end||'([a-z0-9][a-z0-9_-]{0,79}/)*[a-z0-9][a-z0-9_-]{0,79}[.]png$'))
   or coalesce(a->>'sha256','') !~ '^[a-f0-9]{64}$' or (a->>'width')::integer is distinct from w or (a->>'height')::integer is distinct from h
   or coalesce((a->>'bytes')::bigint,0) not between 1 and 5242880 then raise exception 'Invalid artwork image' using errcode='22023';end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='event-artwork' and o.name=a->>'path'
   and o.metadata->>'mimetype'='image/png' and (o.metadata->>'size')::bigint=(a->>'bytes')::bigint) then raise exception 'Upload both verified PNG files first' using errcode='22023';end if;
 end loop;
 if m ? 'homePlacement' then
  pos:=m->'homePlacement';
  if jsonb_typeof(pos) is distinct from 'object' or jsonb_typeof(pos->'scale') is distinct from 'number'
   or jsonb_typeof(pos->'x') is distinct from 'number' or jsonb_typeof(pos->'y') is distinct from 'number' or coalesce((pos->>'scale')::numeric,0) not between .1 and 2
   or (pos->>'x') is null or (pos->>'x')::numeric not between 0 and 1536
   or (pos->>'y') is null or (pos->>'y')::numeric not between 0 and 1024 then raise exception 'Invalid home placement' using errcode='22023';end if;
 end if;
 if m ? 'focusBottom' and (jsonb_typeof(m->'focusBottom') is distinct from 'number' or (m->>'focusBottom') is null or (m->>'focusBottom')::numeric not between 0 and 1254) then raise exception 'Invalid focus placement' using errcode='22023';end if;
 if m ? 'effects' then
  if jsonb_typeof(m->'effects') is distinct from 'array' then raise exception 'Invalid effects' using errcode='22023';end if;
  if jsonb_array_length(m->'effects')>3 or (m->>'kind'='background' and jsonb_array_length(m->'effects')>0) then raise exception 'Unsupported effect composition' using errcode='22023';end if;
  for e in select value from jsonb_array_elements(m->'effects') loop
   if e->>'kind' is distinct from 'warmSteam' or (e ? 'version' and e->'version' is distinct from '1'::jsonb) then raise exception 'Unsupported effect kind or version' using errcode='22023';end if;
   if exists(select 1 from jsonb_object_keys(e) key where key not in ('kind','version','home','focus')) then raise exception 'Unsupported effect parameter' using errcode='22023';end if;
   foreach screen in array array['home','focus'] loop
    pos:=e->screen;
    if jsonb_typeof(pos) is distinct from 'object' then raise exception 'Effect placement required' using errcode='22023';end if;
    if exists(select 1 from jsonb_object_keys(pos) key where key not in ('x','y','width','opacity')) then raise exception 'Unsupported placement parameter' using errcode='22023';end if;
    foreach k in array array['x','y','width','opacity'] loop
     if jsonb_typeof(pos->k) is distinct from 'number' or pos->>k is null then raise exception 'Effect parameter required' using errcode='22023';end if;
     n:=(pos->>k)::numeric;
     if n<0 or n>1 or (k='width' and (n<.01 or n>.5)) or n::text in ('NaN','Infinity','-Infinity') then raise exception 'Effect parameter out of range' using errcode='22023';end if;
    end loop;
   end loop;
  end loop;
 end if;
end $$;


create function private.register_library_artwork(m jsonb,p_activate boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare existing_character text;
begin
 perform private.validate_library_artwork(m);
 perform pg_advisory_xact_lock(hashtextextended('artwork:'||(m->>'kind')||':'||(m->>'id'),0));
 if m->>'kind'='skin' then
  select character into existing_character from public.character_skins where id=m->>'id' for update;
  if found and existing_character<>m->>'character' then raise exception 'Skin character cannot change' using errcode='22023';end if;
  insert into public.character_skins(id,name,character,grant_enabled) values(m->>'id',m->>'name',m->>'character',p_activate)
   on conflict(id) do update set name=excluded.name,grant_enabled=public.character_skins.grant_enabled or excluded.grant_enabled;
 else
  insert into private.event_backgrounds(id,name,home_asset,focus_asset,enabled) values(m->>'id',m->>'name','default','default',p_activate)
   on conflict(id) do update set name=excluded.name,enabled=private.event_backgrounds.enabled or excluded.enabled;
 end if;
 insert into private.artwork_library(kind,content_id,theme,definition) values(m->>'kind',m->>'id',m->>'theme',m)
  on conflict(kind,content_id) do update set theme=excluded.theme,definition=excluded.definition,updated_at=clock_timestamp();
 update public.event_background_versions set revision=revision+1;
 return jsonb_build_object('id',m->>'id','theme',m->>'theme','registered',true,'activated',p_activate);
end $$;
create function private.list_artwork_library(p_theme text default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(a) order by a.theme,a.kind,a.content_id),'[]'::jsonb) from private.artwork_library a where p_theme is null or a.theme=p_theme
$$;

-- Preserve version-1 RPCs and old immutable definitions for already installed apps.
-- Version-2 apps explicitly request library paths through a non-defaulted overload.
create function private.read_library_skin_artwork(p_ids text[],p_room smallint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare legacy jsonb;
begin
 legacy:=private.read_skin_artwork(p_ids,p_room);
 return (select coalesce(jsonb_agg(result.definition order by result.definition->>'id'),'[]'::jsonb) from (
  select value definition from jsonb_array_elements(legacy) where not exists(select 1 from private.artwork_library a where a.kind='skin' and a.content_id=value->>'id')
  union all
  select a.definition from private.artwork_library a where a.kind='skin' and a.content_id=any(p_ids) and (
   exists(select 1 from public.user_skins u where u.user_id=auth.uid() and u.skin_id=a.content_id)
   or exists(select 1 from public.profiles p where p.room_id=p_room and p.invite_verified_at is not null and p.name_confirmed and p.active_skin_id=a.content_id)
  )
 ) result);
end $$;
create function private.room_library_backgrounds(p_room smallint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare snapshot jsonb;
begin
 snapshot:=private.room_event_backgrounds(p_room);
 return jsonb_set(snapshot,'{windows}',coalesce((
  select jsonb_agg(case when a.definition is null then w else w||jsonb_build_object('artwork',a.definition) end order by w->>'startsAt')
  from jsonb_array_elements(snapshot->'windows') w
   join private.event_jobs j on j.id=(w->>'id')::uuid
   left join private.artwork_library a on a.kind='background' and a.content_id=j.background_id
 ),'[]'::jsonb));
end $$;
create or replace function private.schedule_event_artwork(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.event_jobs; r uuid; refs jsonb;
begin
 if (p->>'room_id')::smallint not in (0,1) then raise exception 'Invalid room' using errcode='22023';end if;
 perform pg_advisory_xact_lock(7042026,(p->>'room_id')::int);
 if exists(select 1 from private.event_jobs where id=(p->>'request_id')::uuid) then return private.schedule_event_local(p);end if;
 if p->>'kind'='set_backgrounds' and exists(select 1 from private.artwork_library where kind='background' and content_id=p->>'background_id') then
  if p ? 'artwork_revision' then raise exception 'Themed backgrounds use file paths, not image revisions' using errcode='22023';end if;
 elsif p->>'kind'='set_backgrounds' then
  r:=nullif(p->>'artwork_revision','')::uuid;
  if r is null then
   if p->>'replaces' is not null and exists(select 1 from private.event_jobs where id=(p->>'replaces')::uuid and background_id=p->>'background_id') then
    select artwork_revision into r from private.event_jobs where id=(p->>'replaces')::uuid;
   else select revision into r from private.artwork_publications where kind='background' and content_id=p->>'background_id';end if;
  end if;
  if r is not null and not exists(select 1 from private.artwork_revisions where revision=r and kind='background' and content_id=p->>'background_id' and published_at is not null) then raise exception 'Published matching artwork required' using errcode='22023';end if;
 end if;
 perform private.schedule_event_local(p);
 select coalesce(jsonb_object_agg(content_id,revision),'{}'::jsonb) into refs from private.artwork_publications where kind='skin' and not exists(select 1 from private.artwork_library a where a.kind='skin' and a.content_id=private.artwork_publications.content_id) and content_id in (select value from jsonb_array_elements_text(coalesce(p->'skin_ids','[]')));
 update private.event_jobs set artwork_revision=r,skin_revisions=refs where id=(p->>'request_id')::uuid returning * into j;
 return to_jsonb(j);
end $$;

create function public.admin_register_artwork(p_definition jsonb,p_activate boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select private.register_library_artwork(p_definition,p_activate) $$;
create function public.admin_artwork_library(p_theme text default null) returns jsonb language sql stable security invoker set search_path='' as $$ select private.list_artwork_library(p_theme) $$;
create function public.get_skin_artwork(p_ids text[],p_room_id smallint,p_schema_version integer) returns jsonb language sql stable security invoker set search_path='' as $$ select case when p_schema_version=2 then private.read_library_skin_artwork(p_ids,p_room_id) else private.read_skin_artwork(p_ids,p_room_id) end $$;
create function public.get_event_backgrounds(p_room_id smallint,p_schema_version integer) returns jsonb language sql stable security invoker set search_path='' as $$ select case when p_schema_version=2 then private.room_library_backgrounds(p_room_id) else private.room_event_backgrounds(p_room_id) end $$;
revoke all on function private.validate_library_artwork(jsonb),private.register_library_artwork(jsonb,boolean),private.list_artwork_library(text),private.read_library_skin_artwork(text[],smallint),private.room_library_backgrounds(smallint) from public,anon,authenticated,service_role;
revoke all on function public.admin_register_artwork(jsonb,boolean),public.admin_artwork_library(text),public.get_skin_artwork(text[],smallint,integer),public.get_event_backgrounds(smallint,integer) from public,anon,authenticated,service_role;
grant execute on function private.register_library_artwork(jsonb,boolean),private.list_artwork_library(text),public.admin_register_artwork(jsonb,boolean),public.admin_artwork_library(text) to service_role;
grant execute on function private.read_library_skin_artwork(text[],smallint),private.room_library_backgrounds(smallint),public.get_skin_artwork(text[],smallint,integer),public.get_event_backgrounds(smallint,integer) to authenticated;
commit;
