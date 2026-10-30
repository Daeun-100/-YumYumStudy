begin;
create extension if not exists pg_net with schema extensions;

-- One immutable announcement per user and skin-grant job, even across recovery runs.
create table private.event_notifications (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references private.event_jobs(id),
 run_id uuid not null references private.event_runs(id),
 user_id uuid not null,
 room_id smallint not null check(room_id in (0,1)),
 title text not null,
 body text not null,
 state text not null default 'pending' check(state in ('pending','queued','completed','failed','unknown','configuration_required')),
 http_request_id bigint,
 error_code text,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 unique(job_id,user_id)
);
create index event_notifications_run_idx on private.event_notifications(run_id);
alter table private.event_notifications enable row level security;
revoke all on private.event_notifications from public,anon,authenticated,service_role;

-- Validate optional copy at reservation time, before any Cron is registered.
alter function private.schedule_event(jsonb) rename to schedule_event_artwork;
revoke all on function private.schedule_event_artwork(jsonb) from public,anon,authenticated,service_role;
create function private.schedule_event(p jsonb) returns jsonb
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
 return private.schedule_event_artwork(p);
end $$;
create or replace function public.admin_schedule_event(p_request jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.schedule_event(p_request) $$;

create function private.dispatch_event_notification(p_id uuid,p_retry boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n private.event_notifications; token text; req bigint; problem text;
begin
 select * into strict n from private.event_notifications where id=p_id for update;
 if n.state='completed' or (n.state='queued' and not p_retry) then return jsonb_build_object('id',n.id,'state',n.state);end if;
 -- Reuse the existing trusted DB-to-Edge credential. This endpoint only accepts
 -- an outbox UUID; it cannot choose recipients or provide arbitrary message copy.
 select decrypted_secret into token from vault.decrypted_secrets where name='log_monitor_cron_secret';
 if token is null or length(token)<64 then
  update private.event_notifications set state='configuration_required',error_code='MissingCronCredential',updated_at=clock_timestamp() where id=n.id;
  return jsonb_build_object('id',n.id,'state','configuration_required');
 end if;
 begin
  req:=net.http_post(
   url:='https://hxwwhgxxvyzqqnxlgqde.supabase.co/functions/v1/event-notifications',
   headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),
   body:=jsonb_build_object('id',n.id),timeout_milliseconds:=60000);
  update private.event_notifications set state='queued',http_request_id=req,error_code=null,updated_at=clock_timestamp() where id=n.id;
 exception when others then
  get stacked diagnostics problem=returned_sqlstate;
  update private.event_notifications set state='failed',error_code=problem,updated_at=clock_timestamp() where id=n.id;
 end;
 return (select jsonb_build_object('id',id,'state',state) from private.event_notifications where id=n.id);
end $$;

create function private.enqueue_event_notifications(p_run uuid) returns void
language plpgsql security definer set search_path='' as $$
declare j private.event_jobs; recipient record; nid uuid; custom jsonb; event_name text;
begin
 select jobs.* into strict j from private.event_jobs jobs join private.event_runs r on r.job_id=jobs.id
  where r.id=p_run and r.phase='grant' and r.result in ('completed','partial_failed','failed');
 if j.kind<>'grant_skins' then return;end if;
 custom:=coalesce(j.request->'notification','{}'::jsonb);
 if custom->>'enabled'='false' then return;end if;
 select left(regexp_replace(name,'[[:cntrl:]]',' ','g'),100) into event_name from private.events where id=j.event_id;
 for recipient in select user_id,count(*) skins from private.event_deliveries where run_id=p_run and result='granted' group by user_id loop
  insert into private.event_notifications(job_id,run_id,user_id,room_id,title,body)
   values(j.id,p_run,recipient.user_id,j.room_id,
    coalesce(btrim(custom->>'title'),'이벤트 스킨 선물이 도착했어요!'),
    coalesce(btrim(custom->>'body'),event_name||' · 스킨 '||recipient.skins||'종을 받았어요. 프로필에서 확인해 주세요.'))
   on conflict(job_id,user_id) do nothing returning id into nid;
  if nid is not null then perform private.dispatch_event_notification(nid);end if;
 end loop;
end $$;

create function private.event_notification_after_run() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 -- The HTTP call is asynchronous and starts only after the grant transaction commits.
 -- Queue failures must not undo a successfully granted skin.
 begin
  perform private.enqueue_event_notifications(new.id);
 exception when others then
  raise warning 'Event notification enqueue failed for run %, SQLSTATE %',new.id,sqlstate;
 end;
 return new;
end $$;
create trigger event_skin_notification after update of result on private.event_runs
 for each row when (new.phase='grant' and old.result='running' and new.result in ('completed','partial_failed','failed'))
 execute function private.event_notification_after_run();

create function private.event_notification_payload(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('action','send','id',n.id,'roomId',n.room_id,'title',n.title,'body',n.body,'userIds',jsonb_build_array(n.user_id),'state',n.state)
 from private.event_notifications n where n.id=p_id
$$;
create function private.finish_event_notification(p_id uuid,p_state text,p_error text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_state not in ('completed','failed','unknown','configuration_required') or length(coalesce(p_error,''))>80 then raise exception 'Invalid notification outcome' using errcode='22023';end if;
 update private.event_notifications set state=p_state,error_code=p_error,updated_at=clock_timestamp() where id=p_id and state<>'completed';
end $$;
create function public.admin_event_notification_payload(p_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select private.event_notification_payload(p_id) $$;
create function public.admin_finish_event_notification(p_id uuid,p_state text,p_error text default null) returns void language sql security invoker set search_path='' as $$ select private.finish_event_notification(p_id,p_state,p_error) $$;
create function public.admin_retry_event_notification(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.dispatch_event_notification(p_id,true) $$;
revoke all on function private.schedule_event(jsonb),private.dispatch_event_notification(uuid,boolean),private.enqueue_event_notifications(uuid),private.event_notification_after_run(),private.event_notification_payload(uuid),private.finish_event_notification(uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.admin_event_notification_payload(uuid),public.admin_finish_event_notification(uuid,text,text),public.admin_retry_event_notification(uuid) from public,anon,authenticated,service_role;
grant execute on function private.schedule_event(jsonb),private.dispatch_event_notification(uuid,boolean),private.event_notification_payload(uuid),private.finish_event_notification(uuid,text,text) to service_role;
grant execute on function public.admin_event_notification_payload(uuid),public.admin_finish_event_notification(uuid,text,text),public.admin_retry_event_notification(uuid) to service_role;
commit;
