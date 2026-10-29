begin;

create schema if not exists private;
create extension if not exists pg_cron;

create table private.events (
 id text primary key check(id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
 name text not null check(length(btrim(name)) between 1 and 100),
 document_path text not null check(document_path ~ '^docs/events/[a-zA-Z0-9_-]+\.md$'),
 created_at timestamptz not null default now()
);
create table private.event_backgrounds (
 id text primary key check(id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
 name text not null, home_asset text not null, focus_asset text not null,
 enabled boolean not null default false
);
-- Enable only after the matching app assets have been delivered and checked.
insert into private.event_backgrounds values('halloween','핼러윈','halloween-home','halloween-focus',false);
create table private.event_jobs (
 id uuid primary key,
 event_id text not null references private.events(id),
 request jsonb not null,
 kind text not null check(kind in ('grant_skins','set_backgrounds')),
 config_version integer not null default 1 check(config_version=1),
 room_id smallint not null references public.study_room(id),
 run_at timestamptz not null,
 ends_at timestamptz,
 skin_ids text[] not null default '{}',
 recipients uuid[] not null default '{}',
 background_id text references private.event_backgrounds(id),
 screens text[] not null default '{}',
 state text not null default 'scheduled' check(state in ('scheduled','completed','partial_failed','failed','missed','cancelled','superseded')),
 cron_ids bigint[] not null default '{}',
 replaces uuid references private.event_jobs(id),
 created_at timestamptz not null default now(),
 cancelled_at timestamptz,
 check(isfinite(run_at)),
 check(ends_at is null or (isfinite(ends_at) and ends_at>run_at))
);
create index event_jobs_event_idx on private.event_jobs(event_id,created_at desc);
create index event_jobs_room_window_idx on private.event_jobs(room_id,run_at,ends_at) where kind='set_backgrounds' and state not in ('cancelled','superseded');
create index event_jobs_replaces_idx on private.event_jobs(replaces) where replaces is not null;
create table private.event_runs (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references private.event_jobs(id),
 phase text not null check(phase in ('grant','start','end','cancel')),
 recovery boolean not null default false,
 started_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz,
 result text not null default 'running',
 error_code text
);
create index event_runs_job_idx on private.event_runs(job_id,started_at desc);
create table private.event_deliveries (
 run_id uuid not null references private.event_runs(id),
 user_id uuid not null,
 skin_id text not null,
 result text not null check(result in ('granted','already_owned','failed','excluded')),
 error_code text,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(run_id,user_id,skin_id)
);
create index event_deliveries_user_idx on private.event_deliveries(user_id);
-- Public invalidation signal carries no event content or operator information.
create table public.event_background_versions (
 room_id smallint primary key references public.study_room(id),
 revision bigint not null default 0
);
insert into public.event_background_versions(room_id) select id from public.study_room;
alter table public.event_background_versions enable row level security;
revoke all on public.event_background_versions from public,anon,authenticated;
grant select on public.event_background_versions to authenticated;
grant all on public.event_background_versions to service_role;
create policy "Read admitted room background revision" on public.event_background_versions for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.room_id=event_background_versions.room_id and p.invite_verified_at is not null and p.name_confirmed)
);
alter publication supabase_realtime add table public.event_background_versions;

-- Private tables still use RLS; clients have neither table nor schema access.
alter table private.events enable row level security;
alter table private.event_backgrounds enable row level security;
alter table private.event_jobs enable row level security;
alter table private.event_runs enable row level security;
alter table private.event_deliveries enable row level security;
revoke all on private.events,private.event_backgrounds,private.event_jobs,private.event_runs,private.event_deliveries from public,anon,authenticated,service_role;

create function private.event_cron_expression(p_at timestamptz) returns text
language plpgsql stable set search_path='' as $$
declare t timestamp; next_at timestamptz; y int; tz text:=coalesce(current_setting('cron.timezone',true),'GMT');
begin
 if p_at is null or not isfinite(p_at) or p_at<>date_trunc('minute',p_at) or p_at<=clock_timestamp() or p_at>clock_timestamp()+interval '1 year' then
  raise exception 'Future minute within one year required' using errcode='22023';
 end if;
 -- Only verified UTC-based installations are supported; do not silently drift.
 if tz not in ('GMT','UTC','Etc/UTC') then raise exception 'UTC Cron timezone required' using errcode='22023'; end if;
 t:=p_at at time zone 'UTC';
 y:=extract(year from clock_timestamp() at time zone 'UTC');
 begin
  next_at:=make_timestamptz(y,extract(month from t)::int,extract(day from t)::int,extract(hour from t)::int,extract(minute from t)::int,0,'UTC');
 exception when datetime_field_overflow then next_at:=null;
 end;
 if next_at is null or next_at<=clock_timestamp() then
  begin
   next_at:=make_timestamptz(y+1,extract(month from t)::int,extract(day from t)::int,extract(hour from t)::int,extract(minute from t)::int,0,'UTC');
  exception when datetime_field_overflow then raise exception 'Next Cron occurrence does not match' using errcode='22023'; end;
 end if;
 if next_at<>p_at then raise exception 'Next Cron occurrence does not match' using errcode='22023'; end if;
 return format('%s %s %s %s *',extract(minute from t)::int,extract(hour from t)::int,extract(day from t)::int,extract(month from t)::int);
end $$;

create function private.event_unschedule(p_ids bigint[]) returns void
language plpgsql security definer set search_path='' as $$
declare j bigint;
begin
 foreach j in array p_ids loop
  if exists(select 1 from cron.job where jobid=j) then perform cron.unschedule(j); end if;
 end loop;
end $$;

create function private.event_signal(p_room smallint) returns void
language sql security definer set search_path='' as $$
 update public.event_background_versions set revision=revision+1 where room_id=p_room;
$$;

create function private.execute_event(p_job uuid,p_phase text,p_recovery boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.event_jobs; r uuid; u uuid; s text; owned boolean; problem text;
 total_failed int:=0; handled int:=0; phase_at timestamptz;
begin
 select * into strict j from private.event_jobs where id=p_job for update;
 if p_phase not in ('grant','start','end') or (j.kind='grant_skins' and p_phase<>'grant') or (j.kind='set_backgrounds' and p_phase='grant') then
  raise exception 'Invalid event phase' using errcode='22023';
 end if;
 if j.state in ('cancelled','superseded') or (j.kind='grant_skins' and j.state='completed') then
  perform private.event_unschedule(j.cron_ids); return jsonb_build_object('state',j.state);
 end if;
 phase_at:=case when p_phase='end' then j.ends_at else j.run_at end;
 if clock_timestamp()<phase_at then raise exception 'Event is not due' using errcode='22023'; end if;
 if j.kind='set_backgrounds' and exists(select 1 from private.event_runs where job_id=j.id and phase=p_phase and result='completed') then
  return jsonb_build_object('state','already_completed');
 end if;
 insert into private.event_runs(job_id,phase,recovery) values(j.id,p_phase,p_recovery) returning id into r;
 if not p_recovery and clock_timestamp()>=phase_at+interval '24 hours' then
  update private.event_runs set result='missed',finished_at=clock_timestamp() where id=r;
  if j.kind='grant_skins' then update private.event_jobs set state='missed' where id=j.id; end if;
  if j.kind='grant_skins' or p_phase='end' then perform private.event_unschedule(j.cron_ids); end if;
  return jsonb_build_object('state','missed','runId',r);
 end if;
 if j.kind='set_backgrounds' then
  -- Time window is authoritative even if a boundary job was missed.
  perform private.event_signal(j.room_id);
  update private.event_runs set result='completed',finished_at=clock_timestamp() where id=r;
  if p_phase='end' then
   update private.event_jobs set state='completed' where id=j.id;
   perform private.event_unschedule(j.cron_ids);
  else
   perform private.event_unschedule(j.cron_ids[1:1]);
  end if;
  return jsonb_build_object('state','completed','runId',r);
 end if;
 select count(distinct d.user_id) into handled from private.event_runs er join private.event_deliveries d on d.run_id=er.id where er.job_id=j.id and d.result in ('granted','already_owned');
 foreach u in array j.recipients loop
  if exists(select 1 from private.event_runs er join private.event_deliveries d on d.run_id=er.id
    where er.job_id=j.id and d.user_id=u and d.result in ('granted','already_owned','excluded')) then continue; end if;
  begin
   perform 1 from public.profiles where id=u and room_id=j.room_id and invite_verified_at is not null and name_confirmed for update;
   if not found then
    insert into private.event_deliveries(run_id,user_id,skin_id,result) select r,u,x,'excluded' from unnest(j.skin_ids) x;
    continue;
   end if;
   foreach s in array j.skin_ids loop
    owned:=exists(select 1 from public.user_skins where user_id=u and skin_id=s);
    perform public.admin_grant_skin(u,s,j.room_id,false,null);
    insert into private.event_deliveries(run_id,user_id,skin_id,result) values(r,u,s,case when owned then 'already_owned' else 'granted' end);
   end loop;
   handled:=handled+1;
  exception when others then
   get stacked diagnostics problem=returned_sqlstate;
   total_failed:=total_failed+1;
   insert into private.event_deliveries(run_id,user_id,skin_id,result,error_code) select r,u,x,'failed',problem from unnest(j.skin_ids) x;
  end;
 end loop;
 problem:=case when total_failed=0 then 'completed' when handled=0 then 'failed' else 'partial_failed' end;
 update private.event_runs set result=problem,finished_at=clock_timestamp() where id=r;
 update private.event_jobs set state=problem where id=j.id;
 perform private.event_unschedule(j.cron_ids);
 return jsonb_build_object('state',problem,'runId',r);
end $$;

create function private.cancel_event(p_job uuid,p_superseded boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.event_jobs;
begin
 select * into strict j from private.event_jobs where id=p_job for update;
 if j.state in ('cancelled','superseded') then perform private.event_unschedule(j.cron_ids); return to_jsonb(j); end if;
 if j.kind='grant_skins' and (j.state<>'scheduled' or exists(select 1 from private.event_runs where job_id=j.id)) then
  raise exception 'Executed grants cannot be cancelled' using errcode='22023';
 end if;
 if j.kind='set_backgrounds' and j.ends_at<=clock_timestamp() then raise exception 'Background period already ended' using errcode='22023'; end if;
 update private.event_jobs set state=case when p_superseded then 'superseded' else 'cancelled' end,cancelled_at=clock_timestamp() where id=j.id returning * into j;
 perform private.event_unschedule(j.cron_ids);
 if j.kind='set_backgrounds' then perform private.event_signal(j.room_id); end if;
 insert into private.event_runs(job_id,phase,result,finished_at) values(j.id,'cancel',j.state,clock_timestamp());
 return to_jsonb(j);
end $$;

create function private.schedule_event(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.event_jobs; old private.event_jobs; jid uuid:=(p->>'request_id')::uuid;
 room smallint:=(p->>'room_id')::smallint; kind text:=p->>'kind'; at_time timestamptz:=(p->>'run_at')::timestamptz;
 end_time timestamptz:=nullif(p->>'ends_at','')::timestamptz; rec uuid[]; skins text[]; scr text[];
 start_expr text; end_expr text; ids bigint[]:='{}'; c bigint; replacement uuid:=nullif(p->>'replaces','')::uuid;
begin
 if jsonb_typeof(p)<>'object' or coalesce(p->>'run_at','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' or (p->>'ends_at' is not null and p->>'ends_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$') then raise exception 'Explicit timestamp timezone required' using errcode='22023'; end if;
 if jid is null or room is null or room not in (0,1) or kind is null or kind not in ('grant_skins','set_backgrounds') then raise exception 'Invalid event request' using errcode='22023'; end if;
 -- Serialize room scheduling, replacements and overlap checks.
 perform pg_advisory_xact_lock(7042026,room::int);
 select * into j from private.event_jobs where id=jid;
 if found then
  if j.request<>p then raise exception 'Request ID reused with different input' using errcode='22023'; end if;
  return to_jsonb(j);
 end if;
 if replacement is not null then
  select * into strict old from private.event_jobs where id=replacement for update;
  if old.room_id<>room or old.kind<>kind or old.event_id<>p->>'event_id' then raise exception 'Replacement scope mismatch' using errcode='22023'; end if;
 end if;
 -- A running background may be replaced without a momentary fallback.
 if kind='set_backgrounds' and replacement is not null and old.run_at<=clock_timestamp() and old.ends_at>clock_timestamp() then
  if at_time<>old.run_at then raise exception 'Keep original start when editing active background' using errcode='22023'; end if;
  start_expr:=null;
 else start_expr:=private.event_cron_expression(at_time);
 end if;
 if kind='grant_skins' then
  select array_agg(distinct x order by x) into skins from jsonb_array_elements_text(p->'skin_ids') x;
  if coalesce(cardinality(skins),0)=0 or cardinality(skins)>40 or end_time is not null then raise exception 'Skin list required' using errcode='22023'; end if;
  if exists(select 1 from unnest(skins) x left join public.character_skins s on s.id=x where s.id is null or not s.grant_enabled) then raise exception 'Skin unavailable' using errcode='22023'; end if;
  if replacement is not null then rec:=old.recipients;
  else select array_agg(id order by id) into rec from public.profiles where room_id=room and invite_verified_at is not null and name_confirmed;
  end if;
  if coalesce(cardinality(rec),0)=0 or cardinality(rec)>500 then raise exception 'Admitted recipients required (maximum 500)' using errcode='22023'; end if;
 else
  if end_time is null or end_time<=at_time then raise exception 'Background end required' using errcode='22023'; end if;
  end_expr:=private.event_cron_expression(end_time);
  select array_agg(distinct x order by x) into scr from jsonb_array_elements_text(p->'screens') x;
  if coalesce(cardinality(scr),0)=0 or not scr<@array['home','focus'] then raise exception 'Choose home and/or focus' using errcode='22023'; end if;
  if not exists(select 1 from private.event_backgrounds where id=p->>'background_id' and enabled) then raise exception 'Background unavailable' using errcode='22023'; end if;
  if exists(select 1 from private.event_jobs existing where existing.room_id=room and existing.kind='set_backgrounds' and existing.state not in ('cancelled','superseded')
    and existing.id is distinct from replacement and existing.screens&&scr and tstzrange(existing.run_at,existing.ends_at,'[)')&&tstzrange(at_time,end_time,'[)')) then
   raise exception 'Overlapping background reservation' using errcode='22023';
  end if;
 end if;
 insert into private.events(id,name,document_path) values(p->>'event_id',p->>'name',p->>'document_path') on conflict(id) do nothing;
 if not exists(select 1 from private.events where id=p->>'event_id' and document_path=p->>'document_path') then raise exception 'Event document mismatch' using errcode='22023'; end if;
 if replacement is not null then perform private.cancel_event(replacement,true); end if;
 insert into private.event_jobs(id,event_id,request,kind,room_id,run_at,ends_at,skin_ids,recipients,background_id,screens,replaces)
 values(jid,p->>'event_id',p,kind,room,at_time,end_time,coalesce(skins,'{}'),coalesce(rec,'{}'),case when kind='set_backgrounds' then p->>'background_id' end,coalesce(scr,'{}'),replacement);
 if start_expr is not null then
  c:=cron.schedule('event-'||jid||'-start',start_expr,format('select private.execute_event(%L::uuid,%L,false);',jid,case when kind='grant_skins' then 'grant' else 'start' end));
  ids:=array_append(ids,c);
 else ids:=array_append(ids,null::bigint);
 end if;
 if kind='set_backgrounds' then
  c:=cron.schedule('event-'||jid||'-end',end_expr,format('select private.execute_event(%L::uuid,''end'',false);',jid));
  ids:=array_append(ids,c);
 end if;
 update private.event_jobs set cron_ids=ids where id=jid returning * into j;
 if kind='set_backgrounds' then perform private.event_signal(room); end if;
 return to_jsonb(j);
end $$;

create function private.event_report(p_job uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from private.events e),'[]'::jsonb),
 'backgrounds',coalesce((select jsonb_agg(to_jsonb(b) order by b.id) from private.event_backgrounds b),'[]'::jsonb),
 'jobs',coalesce((select jsonb_agg(to_jsonb(j)||jsonb_build_object(
   'overdue',j.state='scheduled' and j.run_at<now() and not exists(select 1 from private.event_runs where job_id=j.id and phase in ('grant','start')),
   'cron',coalesce((select jsonb_agg(jsonb_build_object('id',c.jobid,'schedule',c.schedule,'active',c.active,'username',c.username)) from cron.job c where c.jobid=any(j.cron_ids)),'[]'::jsonb),
   'cronHistory',coalesce((select jsonb_agg(to_jsonb(h)) from (select jobid,status,start_time,end_time,return_message from cron.job_run_details where jobid=any(j.cron_ids) order by start_time desc limit 10) h),'[]'::jsonb),
   'runs',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('deliveries',coalesce((select jsonb_agg(to_jsonb(d)) from private.event_deliveries d where d.run_id=r.id),'[]'::jsonb)) order by r.started_at) from private.event_runs r where r.job_id=j.id),'[]'::jsonb)
  ) order by j.created_at desc) from private.event_jobs j where p_job is null or j.id=p_job),'[]'::jsonb))
$$;

-- A narrow owner-room reader; operator records remain private.
create function private.room_event_backgrounds(p_room smallint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actual smallint;
begin
 perform public._require_admission();
 select room_id into actual from public.profiles where id=auth.uid();
 if actual is distinct from p_room then raise exception 'Room identity mismatch' using errcode='42501'; end if;
 return jsonb_build_object('serverNow',now(),'roomId',actual,'windows',coalesce((
  select jsonb_agg(jsonb_build_object('id',j.id,'startsAt',j.run_at,'endsAt',j.ends_at,'screens',j.screens,'homeAsset',b.home_asset,'focusAsset',b.focus_asset) order by j.run_at)
  from private.event_jobs j join private.event_backgrounds b on b.id=j.background_id
  where j.room_id=actual and j.kind='set_backgrounds' and j.state not in ('cancelled','superseded') and j.ends_at>now()
 ),'[]'::jsonb));
end $$;

create function public.admin_schedule_event(p_request jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.schedule_event(p_request) $$;
create function public.admin_cancel_event(p_job uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.cancel_event(p_job) $$;
create function public.admin_event_report(p_job uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.event_report(p_job) $$;
create function public.admin_recover_event(p_job uuid,p_phase text) returns jsonb language sql security invoker set search_path='' as $$ select private.execute_event(p_job,p_phase,true) $$;
create function public.get_event_backgrounds(p_room_id smallint) returns jsonb language sql stable security invoker set search_path='' as $$ select private.room_event_backgrounds(p_room_id) $$;
create function private.enable_event_background(p_id text,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 update private.event_backgrounds set enabled=p_enabled where id=p_id;
 if not found then raise exception 'Unknown background' using errcode='22023'; end if;
end $$;
create function public.admin_enable_event_background(p_id text,p_enabled boolean) returns void language sql security invoker set search_path='' as $$ select private.enable_event_background(p_id,p_enabled) $$;

-- Revoke every new function explicitly, including helpers. Never grant execute on all private functions.
revoke all on function private.event_cron_expression(timestamptz),private.event_unschedule(bigint[]),private.event_signal(smallint),private.execute_event(uuid,text,boolean),private.cancel_event(uuid,boolean),private.schedule_event(jsonb),private.event_report(uuid),private.room_event_backgrounds(smallint),private.enable_event_background(text,boolean) from public,anon,authenticated,service_role;
revoke all on function public.admin_schedule_event(jsonb),public.admin_cancel_event(uuid),public.admin_event_report(uuid),public.admin_recover_event(uuid,text),public.admin_enable_event_background(text,boolean),public.get_event_backgrounds(smallint) from public,anon,authenticated,service_role;
grant usage on schema private to service_role,authenticated;
grant execute on function private.schedule_event(jsonb),private.cancel_event(uuid,boolean),private.event_report(uuid),private.execute_event(uuid,text,boolean),private.enable_event_background(text,boolean) to service_role;
grant execute on function public.admin_schedule_event(jsonb),public.admin_cancel_event(uuid),public.admin_event_report(uuid),public.admin_recover_event(uuid,text),public.admin_enable_event_background(text,boolean) to service_role;
grant execute on function private.room_event_backgrounds(smallint),public.get_event_backgrounds(smallint) to authenticated;
commit;
