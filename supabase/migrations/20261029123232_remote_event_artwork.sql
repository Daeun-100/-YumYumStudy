begin;

-- Public cosmetic images only. Client writes remain denied (no objects write policies).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('event-artwork','event-artwork',true,5242880,array['image/png']);
create table private.artwork_revisions (
 revision uuid primary key,
 kind text not null check(kind in ('skin','background')),
 content_id text not null check(content_id ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
 definition jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 published_at timestamptz
);
create index artwork_revisions_content_idx on private.artwork_revisions(kind,content_id,created_at desc);
create table private.artwork_publications (
 kind text not null check(kind in ('skin','background')),
 content_id text not null,
 revision uuid not null references private.artwork_revisions(revision),
 primary key(kind,content_id)
);
create index artwork_publications_revision_idx on private.artwork_publications(revision);
alter table private.artwork_revisions enable row level security;
alter table private.artwork_publications enable row level security;
revoke all on private.artwork_revisions,private.artwork_publications from public,anon,authenticated,service_role;
alter table private.event_jobs add column artwork_revision uuid references private.artwork_revisions(revision),add column skin_revisions jsonb not null default '{}';
create index event_jobs_artwork_revision_idx on private.event_jobs(artwork_revision) where artwork_revision is not null;

create function private.validate_artwork_definition(m jsonb) returns void
language plpgsql set search_path='' as $$
declare screen text; a jsonb; e jsonb; pos jsonb; k text; w int; h int; rev uuid; nm text; n numeric;
begin
 if jsonb_typeof(m) is distinct from 'object' or m->'schemaVersion' is distinct from '1'::jsonb or m->>'kind' is null or m->>'kind' not in ('skin','background')
  or jsonb_typeof(m->'id') is distinct from 'string' or jsonb_typeof(m->'name') is distinct from 'string'
  or coalesce(m->>'id','') !~ '^[a-z0-9][a-z0-9_-]{0,79}$' or coalesce(length(btrim(m->>'name')),0) not between 1 and 60 then raise exception 'Invalid artwork definition' using errcode='22023'; end if;
 if m->>'kind'='background' and m->>'id' !~ '^[a-z0-9][a-z0-9-]{0,79}$' then raise exception 'Invalid background ID' using errcode='22023';end if;
 rev:=(m->>'revision')::uuid;if rev is null then raise exception 'Revision required' using errcode='22023';end if;
 if m->>'kind'='skin' and (m->>'character' is null or m->>'character' not in ('bunny','bear','cat','puppy','maltese','pomeranian','blackcat')) then raise exception 'Invalid character' using errcode='22023';end if;
 foreach screen in array array['home','focus'] loop
  a:=m->screen;
  w:=case when screen='home' then 1536 when m->>'kind'='skin' then 1254 else 1024 end;
  h:=case when screen='home' then 1024 when m->>'kind'='skin' then 1254 else 1536 end;
  if jsonb_typeof(a) is distinct from 'object' or jsonb_typeof(a->'path') is distinct from 'string' or jsonb_typeof(a->'sha256') is distinct from 'string'
   or jsonb_typeof(a->'width') is distinct from 'number' or jsonb_typeof(a->'height') is distinct from 'number' or jsonb_typeof(a->'bytes') is distinct from 'number' or a->>'path' is distinct from (m->>'kind')||'/'||(m->>'id')||'/'||rev::text||'/'||screen||'.png'
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

create function private.stage_artwork(m jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old private.artwork_revisions; rev uuid;
begin
 perform private.validate_artwork_definition(m);rev:=(m->>'revision')::uuid;
 perform pg_advisory_xact_lock(hashtextextended('artwork:'||rev::text,0));
 select * into old from private.artwork_revisions where revision=rev;
 if found then if old.definition<>m then raise exception 'Revision is immutable' using errcode='22023';end if;return to_jsonb(old);end if;
 insert into private.artwork_revisions(revision,kind,content_id,definition) values(rev,m->>'kind',m->>'id',m) returning * into old;
 return to_jsonb(old);
end $$;

create function private.publish_artwork(p_revision uuid,p_activate boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.artwork_revisions; m jsonb; existing_character text;
begin
 select * into strict r from private.artwork_revisions where revision=p_revision for update;m:=r.definition;
 perform private.validate_artwork_definition(m);
 perform pg_advisory_xact_lock(hashtextextended('artwork:'||r.kind||':'||r.content_id,0));
 if r.kind='skin' then
  select character into existing_character from public.character_skins where id=r.content_id for update;
  if found and existing_character<>m->>'character' then raise exception 'Skin character cannot change' using errcode='22023';end if;
  insert into public.character_skins(id,name,character,grant_enabled) values(r.content_id,m->>'name',m->>'character',p_activate)
   on conflict(id) do update set name=excluded.name,grant_enabled=public.character_skins.grant_enabled or excluded.grant_enabled;
 else
  insert into private.event_backgrounds(id,name,home_asset,focus_asset,enabled) values(r.content_id,m->>'name','default','default',p_activate)
   on conflict(id) do update set name=excluded.name,enabled=private.event_backgrounds.enabled or excluded.enabled;
 end if;
 update private.artwork_revisions set published_at=coalesce(published_at,clock_timestamp()) where revision=p_revision;
 insert into private.artwork_publications(kind,content_id,revision) values(r.kind,r.content_id,r.revision)
  on conflict(kind,content_id) do update set revision=excluded.revision;
 update public.event_background_versions set revision=revision+1;
 return jsonb_build_object('kind',r.kind,'id',r.content_id,'revision',r.revision,'published',true,'activated',p_activate);
end $$;

-- Preserve all existing job fields and the old-client response shape.
alter function private.schedule_event(jsonb) rename to schedule_event_local;
revoke all on function private.schedule_event_local(jsonb) from public,anon,authenticated,service_role;
create function private.schedule_event(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.event_jobs; r uuid; refs jsonb;
begin
 if (p->>'room_id')::smallint not in (0,1) then raise exception 'Invalid room' using errcode='22023';end if;
 perform pg_advisory_xact_lock(7042026,(p->>'room_id')::int);
 if exists(select 1 from private.event_jobs where id=(p->>'request_id')::uuid) then return private.schedule_event_local(p);end if;
 if p->>'kind'='set_backgrounds' then
  r:=nullif(p->>'artwork_revision','')::uuid;
  if r is null then
   if p->>'replaces' is not null and exists(select 1 from private.event_jobs where id=(p->>'replaces')::uuid and background_id=p->>'background_id') then
    select artwork_revision into r from private.event_jobs where id=(p->>'replaces')::uuid;
   else select revision into r from private.artwork_publications where kind='background' and content_id=p->>'background_id';end if;
  end if;
  if r is not null and not exists(select 1 from private.artwork_revisions where revision=r and kind='background' and content_id=p->>'background_id' and published_at is not null) then raise exception 'Published matching artwork required' using errcode='22023';end if;
 end if;
 perform private.schedule_event_local(p);
 select coalesce(jsonb_object_agg(content_id,revision),'{}'::jsonb) into refs from private.artwork_publications where kind='skin' and content_id in (select value from jsonb_array_elements_text(coalesce(p->'skin_ids','[]')));
 update private.event_jobs set artwork_revision=r,skin_revisions=refs where id=(p->>'request_id')::uuid returning * into j;
 return to_jsonb(j);
end $$;
create or replace function public.admin_schedule_event(p_request jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.schedule_event(p_request) $$;

create function private.read_skin_artwork(p_ids text[],p_room smallint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actual smallint;
begin
 perform public._require_admission();select room_id into actual from public.profiles where id=auth.uid();
 if actual is distinct from p_room then raise exception 'Room identity mismatch' using errcode='42501';end if;
 if p_ids is null or cardinality(p_ids)>32 then raise exception 'At most 32 skin IDs required' using errcode='22023';end if;
 return coalesce((select jsonb_agg(r.definition order by a.content_id) from private.artwork_publications a join private.artwork_revisions r on r.revision=a.revision
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
  select jsonb_agg(jsonb_build_object('id',j.id,'startsAt',j.run_at,'endsAt',j.ends_at,'screens',j.screens,'homeAsset',b.home_asset,'focusAsset',b.focus_asset,'artwork',r.definition) order by j.run_at)
  from private.event_jobs j join private.event_backgrounds b on b.id=j.background_id left join private.artwork_revisions r on r.revision=j.artwork_revision
  where j.room_id=actual and j.kind='set_backgrounds' and j.state not in ('cancelled','superseded') and j.ends_at>now()
   and j.id in (select choice.id from (
    select distinct on (slot.screen,(candidate.run_at<=now())) candidate.id
    from private.event_jobs candidate cross join lateral unnest(candidate.screens) slot(screen)
    where candidate.room_id=actual and candidate.kind='set_backgrounds' and candidate.state not in ('cancelled','superseded') and candidate.ends_at>now()
    order by slot.screen,(candidate.run_at<=now()),candidate.run_at
   ) choice)
 ),'[]'::jsonb));
end $$;
create function private.artwork_report(p_revision uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('revisions',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from private.artwork_revisions r where p_revision is null or r.revision=p_revision),'[]'::jsonb),
 'publications',coalesce((select jsonb_agg(to_jsonb(p)) from private.artwork_publications p where p_revision is null or p.revision=p_revision),'[]'::jsonb))
$$;
create function public.admin_stage_artwork(p_definition jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.stage_artwork(p_definition) $$;
create function public.admin_publish_artwork(p_revision uuid,p_activate boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select private.publish_artwork(p_revision,p_activate) $$;
create function public.admin_artwork_report(p_revision uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$ select private.artwork_report(p_revision) $$;
create function public.get_skin_artwork(p_ids text[],p_room_id smallint) returns jsonb language sql stable security invoker set search_path='' as $$ select private.read_skin_artwork(p_ids,p_room_id) $$;
revoke all on function private.validate_artwork_definition(jsonb),private.stage_artwork(jsonb),private.publish_artwork(uuid,boolean),private.schedule_event(jsonb),private.read_skin_artwork(text[],smallint),private.artwork_report(uuid) from public,anon,authenticated,service_role;
revoke all on function public.admin_stage_artwork(jsonb),public.admin_publish_artwork(uuid,boolean),public.admin_artwork_report(uuid),public.get_skin_artwork(text[],smallint) from public,anon,authenticated,service_role;
grant execute on function private.stage_artwork(jsonb),private.publish_artwork(uuid,boolean),private.artwork_report(uuid),private.schedule_event(jsonb),public.admin_stage_artwork(jsonb),public.admin_publish_artwork(uuid,boolean),public.admin_artwork_report(uuid) to service_role;
grant execute on function private.read_skin_artwork(text[],smallint),public.get_skin_artwork(text[],smallint) to authenticated;
commit;
