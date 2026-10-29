begin;
create schema if not exists admin_toast_private;
revoke all on schema admin_toast_private from public, anon, authenticated;

create table public.admin_toast_campaigns (
 id uuid primary key,
 schema_version integer not null default 1 check (schema_version=1),
 kind text not null check (kind in ('update_ready','info_notice')),
 room_id smallint not null references public.study_room(id),
 audience text not null check (audience in ('room','users')),
 deleted_at timestamptz,
 starts_at timestamptz not null,
 expires_at timestamptz not null,
 platforms text[] not null check (cardinality(platforms)>0 and platforms <@ array['android','ios','web']::text[]),
 app_variant text not null check (app_variant in ('test','production') and (app_variant<>'production' or room_id=1)),
 min_capability_version integer not null default 1,
 payload jsonb not null check (jsonb_typeof(payload)='object'),
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (expires_at>starts_at and expires_at<=starts_at+interval '30 days')
);
create table public.admin_toast_recipients (
 campaign_id uuid not null references public.admin_toast_campaigns(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 primary key(campaign_id,user_id)
);
create index admin_toast_recipient_user on public.admin_toast_recipients(user_id,campaign_id);
create index admin_toast_active_room on public.admin_toast_campaigns(room_id,starts_at,expires_at) where deleted_at is null;
create table public.admin_toast_receipts (
 campaign_id uuid not null references public.admin_toast_campaigns(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 installation_id uuid not null,
 shown_at timestamptz not null default statement_timestamp(),
 completed_at timestamptz,
 reason text check (reason in ('shown','close','destination')),
 primary key(campaign_id,user_id,installation_id)
);
create table admin_toast_private.requests (
 id uuid primary key, input_hash text not null, result jsonb not null, created_at timestamptz not null default now()
);
create table admin_toast_private.audit (
 request_id uuid primary key references admin_toast_private.requests(id) on delete cascade,
 action text not null, campaign_id uuid, created_at timestamptz not null default now()
);
alter table public.admin_toast_campaigns enable row level security;
alter table public.admin_toast_recipients enable row level security;
alter table public.admin_toast_receipts enable row level security;
alter table admin_toast_private.requests enable row level security;
alter table admin_toast_private.audit enable row level security;
revoke all on public.admin_toast_campaigns,public.admin_toast_recipients,public.admin_toast_receipts from public,anon,authenticated;
revoke all on admin_toast_private.requests,admin_toast_private.audit from public,anon,authenticated;
grant usage on schema admin_toast_private to service_role;
grant all on public.admin_toast_campaigns,public.admin_toast_recipients,public.admin_toast_receipts,admin_toast_private.requests,admin_toast_private.audit to service_role;
grant select on public.admin_toast_campaigns,public.admin_toast_recipients,public.admin_toast_receipts to authenticated;
grant insert(campaign_id,user_id,installation_id) on public.admin_toast_receipts to authenticated;
grant update(completed_at,reason) on public.admin_toast_receipts to authenticated;

create policy "Own toast recipient rows" on public.admin_toast_recipients for select to authenticated
 using (user_id=(select auth.uid()) and (select public.current_study_room()) is not null);
-- Include future-start notices so the client can activate them without a scheduler.
create policy "Read eligible room toasts" on public.admin_toast_campaigns for select to authenticated
 using (room_id=(select public.current_study_room()) and deleted_at is null and expires_at>statement_timestamp()
 and (audience='room' or exists(select 1 from public.admin_toast_recipients r where r.campaign_id=id and r.user_id=(select auth.uid()))));
create policy "Read own toast receipts" on public.admin_toast_receipts for select to authenticated
 using (user_id=(select auth.uid()) and (select public.current_study_room()) is not null);
create policy "Record own eligible toast" on public.admin_toast_receipts for insert to authenticated
 with check (user_id=(select auth.uid()) and exists(select 1 from public.admin_toast_campaigns c where c.id=campaign_id and c.starts_at<=statement_timestamp()));
create policy "Complete own eligible toast" on public.admin_toast_receipts for update to authenticated
 using (user_id=(select auth.uid()))
 with check (user_id=(select auth.uid()) and exists(select 1 from public.admin_toast_campaigns c where c.id=campaign_id and c.starts_at<=statement_timestamp()));

create policy "Receive admin toast change signal" on realtime.messages for select to authenticated
 using (extension='broadcast' and realtime.topic()='admin-toasts:room:' || public.current_study_room()::text);
-- Restrictive policy also prevents an unrelated permissive publishing policy from authorizing this namespace.
create policy "No client admin toast publishing" on realtime.messages as restrictive for insert to authenticated
 with check (realtime.topic() not like 'admin-toasts:%');
-- Deletion is terminal. Even privileged accidental updates cannot restore a deleted notice.
create function admin_toast_private.prevent_restore() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if OLD.deleted_at is not null and NEW.deleted_at is distinct from OLD.deleted_at then
  raise exception 'Deleted notices cannot be restored; create a new notice' using errcode='22023';
 end if;
 return NEW;
end $$;
revoke all on function admin_toast_private.prevent_restore() from public,anon,authenticated;
create trigger admin_toast_no_restore before update on public.admin_toast_campaigns
 for each row execute function admin_toast_private.prevent_restore();

create function admin_toast_private.signal() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform realtime.send(jsonb_build_object('changed',true),'changed','admin-toasts:room:' || coalesce(NEW.room_id,OLD.room_id)::text,true);
 return null;
end $$;
revoke all on function admin_toast_private.signal() from public,anon,authenticated;
create trigger admin_toast_changed after insert or update or delete on public.admin_toast_campaigns
 for each row execute function admin_toast_private.signal();

create function public.get_admin_toasts() returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('server_now',statement_timestamp(),'campaigns',coalesce((select jsonb_agg(to_jsonb(c) order by c.starts_at,c.id) from public.admin_toast_campaigns c),'[]'::jsonb));
$$;
create function public.record_admin_toast(p_campaign_id uuid,p_installation_id uuid,p_event text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or public.current_study_room() is null or p_event not in ('shown','close','destination') then
  raise exception 'Invalid toast receipt' using errcode='42501';
 end if;
 insert into public.admin_toast_receipts(campaign_id,user_id,installation_id) values(p_campaign_id,auth.uid(),p_installation_id)
 on conflict(campaign_id,user_id,installation_id) do nothing;
 if p_event<>'shown' or exists(select 1 from public.admin_toast_campaigns where id=p_campaign_id and kind='info_notice') then
  update public.admin_toast_receipts set completed_at=coalesce(completed_at,statement_timestamp()),reason=coalesce(reason,p_event)
  where campaign_id=p_campaign_id and user_id=auth.uid() and installation_id=p_installation_id;
 end if;
end $$;
revoke all on function public.get_admin_toasts(),public.record_admin_toast(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.get_admin_toasts(),public.record_admin_toast(uuid,uuid,text) to authenticated;

-- Only the Edge Function's service role may invoke this transactional command API.
create function public.manage_admin_toasts(p_input jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 a text:=p_input->>'action'; req uuid:=(p_input->>'requestId')::uuid; cid uuid:=(p_input->>'campaignId')::uuid;
 r smallint:=(p_input->>'roomId')::smallint; input_hash text:=encode(sha256(convert_to(p_input::text,'UTF8')),'hex');
 prior admin_toast_private.requests; c public.admin_toast_campaigns;
 result jsonb; target_count integer; expected_count integer; u uuid;
begin
 if req is null or a not in ('preview','create','delete','list','status') or p_input ? 'enabled' or p_input ? 'sourceCampaignId' then
  raise exception 'Use create or delete; notices cannot be re-enabled' using errcode='22023';
 end if;
 if a='status' then
  if cid is not null then
   select * into c from public.admin_toast_campaigns where id=cid;
   if not found then raise exception 'Campaign missing' using errcode='22023'; end if;
   return jsonb_build_object('campaign',to_jsonb(c),'shownInstallations',(select count(*) from public.admin_toast_receipts where campaign_id=cid),
    'completedInstallations',(select count(*) from public.admin_toast_receipts where campaign_id=cid and completed_at is not null),
    'shownUsers',(select count(distinct user_id) from public.admin_toast_receipts where campaign_id=cid));
  end if;
  select * into prior from admin_toast_private.requests where id=req;
  return case when found then prior.result else jsonb_build_object('status','not_found') end;
 end if;
 if a='list' then return jsonb_build_object('campaigns',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from
  (select * from public.admin_toast_campaigns where room_id=r and deleted_at is null order by created_at desc limit 100) t),'[]'::jsonb)); end if;
 perform pg_advisory_xact_lock(hashtext('admin_toasts_commands'));
 if a<>'preview' then
  select * into prior from admin_toast_private.requests where id=req;
  if found then
   if prior.input_hash<>input_hash then raise exception 'Request UUID already used' using errcode='40001'; end if;
   return prior.result;
  end if;
  if (select count(*) from admin_toast_private.requests where created_at>now()-interval '1 minute')>=60 then
   raise exception 'Admin toast rate limit' using errcode='22023';
  end if;
 end if;
 if a='delete' then
  select * into c from public.admin_toast_campaigns where id=cid for update;
  if not found then raise exception 'Campaign missing' using errcode='22023'; end if;
  if (p_input->>'expectedRevision')::integer is null or (p_input->>'expectedRevision')::integer<1 then
   raise exception 'Revision required' using errcode='22023';
  end if;
  if c.deleted_at is null then
   if c.revision<>(p_input->>'expectedRevision')::integer then raise exception 'Revision conflict' using errcode='40001'; end if;
   update public.admin_toast_campaigns set deleted_at=now(),revision=revision+1,updated_at=now() where id=cid returning * into c;
  end if;
 else
  if r not in (0,1) or cid is null or p_input->>'kind' not in ('update_ready','info_notice') then raise exception 'Invalid campaign' using errcode='22023'; end if;
  if (p_input->>'expiresAt')::timestamptz<=now() then raise exception 'Campaign already expired' using errcode='22023'; end if;
  if jsonb_typeof(p_input->'userIds')='array' then
   expected_count:=jsonb_array_length(p_input->'userIds');
   if expected_count not between 1 and 100 then raise exception 'Invalid recipient count' using errcode='22023'; end if;
   select count(*) into target_count from public.profiles p where p.id in (select value::uuid from jsonb_array_elements_text(p_input->'userIds'))
    and p.room_id=r and p.name_confirmed and p.invite_verified_at is not null;
   if target_count<>expected_count then raise exception 'Recipients missing or not admitted to room' using errcode='22023'; end if;
  else
   select count(*) into target_count from public.profiles p where p.room_id=r and p.name_confirmed and p.invite_verified_at is not null;
  end if;
  if target_count=0 then raise exception 'No admitted recipients' using errcode='22023'; end if;
  if (select count(*) from public.admin_toast_campaigns where room_id=r and deleted_at is null and expires_at>now())>=20 then
   raise exception 'Active campaign limit exceeded' using errcode='22023';
  end if;
  if p_input->>'kind'='update_ready' and exists(select 1 from public.admin_toast_campaigns other where other.deleted_at is null and other.room_id=r
   and other.app_variant=p_input->>'appVariant' and other.kind='update_ready' and other.payload->>'updateId'=p_input->'payload'->>'updateId'
   and other.starts_at<(p_input->>'expiresAt')::timestamptz and other.expires_at>(p_input->>'startsAt')::timestamptz) then
   raise exception 'Duplicate active update notice' using errcode='22023';
  end if;
  if a='preview' then
   if exists(select 1 from public.admin_toast_campaigns where id=cid) then raise exception 'Campaign UUID already used' using errcode='22023'; end if;
   return jsonb_build_object('status','preview','targetCount',target_count,'prepared',p_input-'action'||jsonb_build_object('action','create'));
  end if;
  insert into public.admin_toast_campaigns(id,kind,room_id,audience,starts_at,expires_at,platforms,app_variant,payload)
  values(cid,p_input->>'kind',r,case when jsonb_typeof(p_input->'userIds')='array' then 'users' else 'room' end,
   (p_input->>'startsAt')::timestamptz,(p_input->>'expiresAt')::timestamptz,array(select jsonb_array_elements_text(p_input->'platforms')),
   p_input->>'appVariant',p_input->'payload') returning * into c;
  if jsonb_typeof(p_input->'userIds')='array' then
   for u in select value::uuid from jsonb_array_elements_text(p_input->'userIds') loop
    insert into public.admin_toast_recipients values(cid,u);
   end loop;
  end if;
 end if;
 select count(*) into target_count from public.profiles p where p.room_id=c.room_id and p.name_confirmed and p.invite_verified_at is not null
  and (c.audience='room' or exists(select 1 from public.admin_toast_recipients rr where rr.campaign_id=c.id and rr.user_id=p.id));
 result:=jsonb_build_object('status',case when a='delete' then 'deleted' else 'saved' end,'campaign',to_jsonb(c),'targetCount',target_count);
 insert into admin_toast_private.requests values(req,input_hash,result,now());
 insert into admin_toast_private.audit(request_id,action,campaign_id) values(req,a,cid);
 return result;
end $$;
revoke all on function public.manage_admin_toasts(jsonb) from public,anon,authenticated;
grant execute on function public.manage_admin_toasts(jsonb) to service_role;

create function public.cleanup_admin_toasts() returns void language plpgsql security invoker set search_path='' as $$
begin
 delete from admin_toast_private.requests where created_at<now()-interval '90 days';
 delete from public.admin_toast_receipts where shown_at<now()-interval '90 days';
 delete from public.admin_toast_campaigns where coalesce(deleted_at,expires_at)<now()-interval '90 days';
end $$;
revoke all on function public.cleanup_admin_toasts() from public,anon,authenticated;
grant execute on function public.cleanup_admin_toasts() to service_role;
-- pg_cron is already required by this project's leave operations.
select cron.schedule('cleanup-admin-toasts','17 19 * * *','select public.cleanup_admin_toasts()');
commit;
