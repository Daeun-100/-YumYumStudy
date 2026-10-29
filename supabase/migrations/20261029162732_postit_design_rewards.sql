begin;
-- Only paper snapshots need an internal immutable reference; operators use theme/path.
create table private.postit_artwork_snapshots (
 revision uuid primary key, content_id text not null, definition jsonb not null, created_at timestamptz not null default clock_timestamp()
);
create index postit_artwork_snapshots_content_idx on private.postit_artwork_snapshots(content_id);
alter table private.postit_artwork_snapshots enable row level security;
revoke all on private.postit_artwork_snapshots from public,anon,authenticated,service_role;
create table private.postit_designs (
 id text primary key, name text not null, grant_enabled boolean not null default false, artwork_revision uuid not null references private.postit_artwork_snapshots(revision)
);
create table private.user_postit_designs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 design_id text not null references private.postit_designs(id), granted_at timestamptz not null default clock_timestamp(),
 source_id uuid not null, unique(user_id,design_id)
);
create index user_postit_designs_design_idx on private.user_postit_designs(design_id);
create table private.postit_reward_rules (
 id uuid primary key, event_id text not null references private.events(id), room_id smallint not null references public.study_room(id),
 design_id text not null references private.postit_designs(id), starts_at timestamptz not null, ends_at timestamptz not null,
 required_seconds integer not null check(required_seconds between 1 and 86400), request jsonb not null,
 created_at timestamptz not null default clock_timestamp(), cancelled_at timestamptz,
 check(isfinite(starts_at) and isfinite(ends_at) and ends_at>starts_at),
 check(required_seconds<=floor(extract(epoch from ends_at-starts_at))),
 check(ends_at <= ((public.study_date(starts_at)+1+time '06:00') at time zone 'Asia/Seoul'))
);
create index postit_reward_rules_room_idx on private.postit_reward_rules(room_id,starts_at) where cancelled_at is null;
create index postit_reward_rules_event_idx on private.postit_reward_rules(event_id);
create index postit_reward_rules_design_idx on private.postit_reward_rules(design_id);
create table private.postit_reward_deliveries (
 rule_id uuid not null references private.postit_reward_rules(id), user_id uuid not null references public.profiles(id) on delete cascade,
 result text not null check(result in ('granted','already_owned')), recorded_at timestamptz not null default clock_timestamp(),
 primary key(rule_id,user_id)
);
create index postit_reward_deliveries_user_idx on private.postit_reward_deliveries(user_id);
alter table private.postit_designs enable row level security;
alter table private.user_postit_designs enable row level security;
alter table private.postit_reward_rules enable row level security;
alter table private.postit_reward_deliveries enable row level security;
revoke all on private.postit_designs,private.user_postit_designs,private.postit_reward_rules,private.postit_reward_deliveries from public,anon,authenticated,service_role;
alter table public.room_postits add column design_id text references private.postit_designs(id), add column design_revision uuid references private.postit_artwork_snapshots(revision);
alter table public.room_postits add constraint postit_design_pair check((design_id is null)=(design_revision is null));
create index room_postits_design_revision_idx on public.room_postits(design_revision) where design_revision is not null;
create index room_postits_design_idx on public.room_postits(design_id) where design_id is not null;

create function private.validate_postit_definition(m jsonb) returns void language plpgsql set search_path='' as $$
declare a jsonb; part text; w numeric; h numeric;
begin
 if jsonb_typeof(m) is distinct from 'object' or m->'schemaVersion' is distinct from '2'::jsonb or m->>'kind' is distinct from 'postit'
  or jsonb_typeof(m->'id') is distinct from 'string' or coalesce(m->>'id','') !~ '^[a-z0-9][a-z0-9_-]{0,79}$'
  or jsonb_typeof(m->'theme') is distinct from 'string' or coalesce(m->>'theme','') !~ '^[a-z0-9][a-z0-9_-]{0,79}$'
  or jsonb_typeof(m->'name') is distinct from 'string' or coalesce(length(btrim(m->>'name')),0) not between 1 and 60
  or coalesce(m->>'fallbackColor','') not in ('#F9E8A0','#F7CED4','#DAE8BE') or coalesce(m->>'textColor','') !~ '^#[0-9A-Fa-f]{6}$'
  or exists(select 1 from jsonb_object_keys(m) k where k not in ('schemaVersion','kind','id','name','theme','paper','preview','fallbackColor','textColor'))
 then raise exception 'Invalid postit definition; use theme/path without image revisions' using errcode='22023';end if;
 foreach part in array array['paper','preview'] loop
 if part='preview' and not (m ? 'preview') then continue;end if;
 a:=m->part;
 if jsonb_typeof(a) is distinct from 'object' or coalesce(a->>'path','') !~ ('^'||(m->>'theme')||'/postits/([a-z0-9][a-z0-9_-]{0,79}/)*[a-z0-9][a-z0-9_-]{0,79}[.]png$') or length(a->>'path')>240
  or jsonb_typeof(a->'sha256') is distinct from 'string' or coalesce(a->>'sha256','') !~ '^[a-f0-9]{64}$'
  or jsonb_typeof(a->'width') is distinct from 'number' or jsonb_typeof(a->'height') is distinct from 'number'
  or jsonb_typeof(a->'bytes') is distinct from 'number' or coalesce((a->>'bytes')::numeric,0) not between 1 and 2097152 or (a->>'bytes')::numeric<>trunc((a->>'bytes')::numeric)
 then raise exception 'Invalid postit PNG' using errcode='22023';end if;
 w:=(a->>'width')::numeric;h:=(a->>'height')::numeric;
 if w not between 512 and 2048 or h not between 512 and 2048 or w<>trunc(w) or h<>trunc(h)
  or (part='preview' and w<>h) or (part='paper' and (w>h*2 or h>w*2)) then raise exception 'Invalid postit PNG dimensions' using errcode='22023';end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='event-artwork' and o.name=a->>'path' and o.metadata->>'mimetype'='image/png' and (o.metadata->>'size')::bigint=(a->>'bytes')::bigint)
 then raise exception 'Upload verified postit PNG first' using errcode='22023';end if;
 end loop;
end $$;
revoke all on function private.validate_postit_definition(jsonb) from public,anon,authenticated,service_role;
alter table private.artwork_library drop constraint artwork_library_kind_check;
alter table private.artwork_library add constraint artwork_library_kind_check check(kind in ('skin','background','postit'));
alter function private.register_library_artwork(jsonb,boolean) rename to register_scene_library_artwork;
revoke all on function private.register_scene_library_artwork(jsonb,boolean) from public,anon,authenticated,service_role;
create function private.register_library_artwork(m jsonb,p_activate boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous jsonb; snapshot_id uuid;
begin
 if m->>'kind' is distinct from 'postit' then return private.register_scene_library_artwork(m,p_activate);end if;
 perform private.validate_postit_definition(m);
 perform pg_advisory_xact_lock(hashtextextended('artwork:postit:'||(m->>'id'),0));
 select definition into previous from private.artwork_library where kind='postit' and content_id=m->>'id';
 if previous=m then
  if p_activate then update private.postit_designs set grant_enabled=true where id=m->>'id';end if;
  return jsonb_build_object('id',m->>'id','theme',m->>'theme','registered',true,'activated',p_activate);
 end if;
 snapshot_id:=gen_random_uuid();
 insert into private.postit_artwork_snapshots(revision,content_id,definition) values(snapshot_id,m->>'id',m||jsonb_build_object('revision',snapshot_id));
 insert into private.postit_designs(id,name,grant_enabled,artwork_revision) values(m->>'id',m->>'name',p_activate,snapshot_id)
 on conflict(id) do update set name=excluded.name,grant_enabled=private.postit_designs.grant_enabled or excluded.grant_enabled,artwork_revision=excluded.artwork_revision;
 insert into private.artwork_library(kind,content_id,theme,definition) values('postit',m->>'id',m->>'theme',m)
 on conflict(kind,content_id) do update set theme=excluded.theme,definition=excluded.definition,updated_at=clock_timestamp();
 return jsonb_build_object('id',m->>'id','theme',m->>'theme','registered',true,'activated',p_activate);
end $$;
create or replace function public.admin_register_artwork(p_definition jsonb,p_activate boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select private.register_library_artwork(p_definition,p_activate) $$;
revoke all on function private.register_library_artwork(jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function private.register_library_artwork(jsonb,boolean) to service_role;
create function private.configure_postit_reward(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare old private.postit_reward_rules; rid uuid:=(p->>'request_id')::uuid;
begin
 if rid is null or p->>'event_id' is null or p->>'room_id' is null or (p->>'room_id')::int not in (0,1)
  or p->>'starts_at' is null or p->>'ends_at' is null or p->>'required_seconds' is null or p->>'design_id' is null
 then raise exception 'Complete postit reward configuration required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('postit-rule:'||rid,0));
 select * into old from private.postit_reward_rules where id=rid;
 if found then if old.request<>p then raise exception 'Request ID reused with different input' using errcode='22023';end if;return to_jsonb(old);end if;
 if not exists(select 1 from private.postit_designs d where d.id=p->>'design_id' and d.grant_enabled)
 then raise exception 'Published enabled postit design required' using errcode='22023';end if;
 insert into private.events(id,name,document_path) values(p->>'event_id',p->>'name',p->>'document_path') on conflict(id) do nothing;
 insert into private.postit_reward_rules(id,event_id,room_id,design_id,starts_at,ends_at,required_seconds,request)
 values(rid,p->>'event_id',(p->>'room_id')::smallint,p->>'design_id',(p->>'starts_at')::timestamptz,(p->>'ends_at')::timestamptz,(p->>'required_seconds')::int,p) returning * into old;
 return to_jsonb(old);
end $$;
create function public.admin_configure_postit_reward(p_request jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.configure_postit_reward(p_request) $$;
create function private.manage_postit_rewards(p_id uuid,p_cancel boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_cancel then
  update private.postit_reward_rules set cancelled_at=coalesce(cancelled_at,clock_timestamp()) where id=p_id;
  if not found then raise exception 'Unknown postit rule' using errcode='22023';end if;
 end if;
 return jsonb_build_object('rules',coalesce((select jsonb_agg(to_jsonb(r)) from private.postit_reward_rules r where p_id is null or r.id=p_id),'[]'::jsonb),
 'deliveries',coalesce((select jsonb_agg(to_jsonb(d)) from private.postit_reward_deliveries d where p_id is null or d.rule_id=p_id),'[]'::jsonb));
end $$;
create function public.admin_postit_reward_report(p_id uuid default null,p_cancel boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select private.manage_postit_rewards(p_id,p_cancel) $$;

create function private.sync_postit_designs(p_room smallint) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); actual smallint; rule private.postit_reward_rules; secs bigint; added uuid; results jsonb:='[]';
 t timestamptz:=statement_timestamp(); next_check numeric; remaining numeric; manifest jsonb;
begin
 perform public._require_admission();select room_id into actual from public.profiles where id=uid for update;
 if actual is distinct from p_room then raise exception 'Room identity mismatch' using errcode='42501';end if;
 for rule in select r.* from private.postit_reward_rules r join private.postit_designs d on d.id=r.design_id and d.grant_enabled
  where r.room_id=actual and r.cancelled_at is null
   and not exists(select 1 from private.postit_reward_deliveries x where x.rule_id=r.id and x.user_id=uid)
  order by r.starts_at,r.id for share of r loop
  if t<rule.starts_at then
   remaining:=extract(epoch from rule.starts_at-t);
  else
   select coalesce(sum(greatest(0,floor(extract(epoch from least(coalesce(s.ended_at,t),t,rule.ends_at)-greatest(s.started_at,rule.starts_at))))),0)
    into secs from public.study_sessions s where s.user_id=uid and s.room_id=actual and s.started_at<rule.ends_at and coalesce(s.ended_at,t)>rule.starts_at;
   if secs>=rule.required_seconds then
    added:=null;
    insert into private.user_postit_designs(user_id,design_id,source_id) values(uid,rule.design_id,rule.id)
     on conflict(user_id,design_id) do nothing returning id into added;
    insert into private.postit_reward_deliveries(rule_id,user_id,result) values(rule.id,uid,case when added is null then 'already_owned' else 'granted' end);
    continue;
   end if;
   remaining:=null;
   if t<rule.ends_at and exists(select 1 from public.study_sessions s where s.user_id=uid and s.room_id=actual and s.ended_at is null) then
    remaining:=least(rule.required_seconds-secs,extract(epoch from rule.ends_at-t));
   end if;
  end if;
  if remaining>0 then next_check:=least(next_check,remaining);end if;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('grantId',g.id,'grantedAt',g.granted_at,'artwork',a.definition) order by g.granted_at,g.id),'[]'::jsonb)
 into results from private.user_postit_designs g join private.postit_designs d on d.id=g.design_id
 join private.postit_artwork_snapshots a on a.revision=d.artwork_revision where g.user_id=uid;
 return jsonb_build_object('serverNow',t,'owned',results,'nextCheckSeconds',next_check,
 'visible',coalesce((select jsonb_agg(a.definition) from private.postit_artwork_snapshots a where a.revision in (
 select n.design_revision from public.room_postits n where n.room_id=actual and n.study_date=public.study_date(t) and n.deleted_at is null)),'[]'::jsonb));
end $$;
create function public.sync_postit_designs(p_room_id smallint) returns jsonb language sql security invoker set search_path='' as $$ select private.sync_postit_designs(p_room_id) $$;

-- Separate name avoids overloading the old RPC and keeps old clients working.
create function private.put_designed_postit(p_id uuid,p_text text,p_color text,p_x double precision,p_y double precision,p_design_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r smallint:=public.current_study_room(); n public.room_postits; m private.postit_artwork_snapshots; d date:=public.study_date(statement_timestamp());
begin
 if r is null then raise exception 'Room admission required' using errcode='42501';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into n from public.room_postits where id=p_id;
 if found then
  if n.author_id<>auth.uid() or n.room_id<>r then raise exception 'Invalid note' using errcode='42501';end if;
  return to_jsonb(n);
 end if;
 if p_design_id is null then return public.put_room_postit(p_id,p_text,p_color,p_x,p_y);end if;
 if not exists(select 1 from private.user_postit_designs where user_id=auth.uid() and design_id=p_design_id) then raise exception '보유한 종이 디자인인지 다시 확인해 주세요.' using errcode='22023';end if;
 select a.* into m from private.postit_designs p join private.postit_artwork_snapshots a on a.revision=p.artwork_revision where p.id=p_design_id;
 if not found then raise exception '종이 디자인을 불러올 수 없어요.' using errcode='22023';end if;
 if (select count(*) from public.room_postits where author_id=auth.uid() and study_date=d)>=30 then raise exception '오늘은 포스트잇을 30개까지 남길 수 있어요.' using errcode='22023';end if;
 insert into public.room_postits(id,room_id,author_id,author,text,color,x,y,study_date,design_id,design_revision)
 select p_id,r,id,display_name,btrim(p_text),m.definition->>'fallbackColor',p_x,p_y,d,p_design_id,m.revision from public.profiles where id=auth.uid() returning * into n;
 return to_jsonb(n);
end $$;
create function public.put_designed_postit(p_id uuid,p_text text,p_color text,p_x double precision,p_y double precision,p_design_id text default null) returns jsonb language sql security invoker set search_path='' as $$ select private.put_designed_postit(p_id,p_text,p_color,p_x,p_y,p_design_id) $$;
revoke all on function private.configure_postit_reward(jsonb),private.manage_postit_rewards(uuid,boolean),private.sync_postit_designs(smallint),private.put_designed_postit(uuid,text,text,double precision,double precision,text),public.admin_configure_postit_reward(jsonb),public.admin_postit_reward_report(uuid,boolean),public.sync_postit_designs(smallint),public.put_designed_postit(uuid,text,text,double precision,double precision,text) from public,anon,authenticated,service_role;
grant execute on function private.configure_postit_reward(jsonb),private.manage_postit_rewards(uuid,boolean),public.admin_configure_postit_reward(jsonb),public.admin_postit_reward_report(uuid,boolean) to service_role;
grant execute on function private.sync_postit_designs(smallint),private.put_designed_postit(uuid,text,text,double precision,double precision,text),public.sync_postit_designs(smallint),public.put_designed_postit(uuid,text,text,double precision,double precision,text) to authenticated;
create function private.set_postit_design_enabled(p_id text,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_enabled is null then raise exception 'Enabled state required' using errcode='22023';end if;
 update private.postit_designs set grant_enabled=p_enabled where id=p_id;
 if not found then raise exception 'Unknown postit design' using errcode='22023';end if;
end $$;
create function public.admin_set_postit_design_enabled(p_id text,p_enabled boolean) returns void language sql security invoker set search_path='' as $$ select private.set_postit_design_enabled(p_id,p_enabled) $$;
revoke all on function private.set_postit_design_enabled(text,boolean),public.admin_set_postit_design_enabled(text,boolean) from public,anon,authenticated,service_role;
grant execute on function private.set_postit_design_enabled(text,boolean),public.admin_set_postit_design_enabled(text,boolean) to service_role;
notify pgrst, 'reload schema';
commit;
