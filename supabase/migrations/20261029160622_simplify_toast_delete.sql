-- Delete is terminal and idempotent; no edit revision needs to be checked.
-- Keep the response revision column for clients already using it.
begin;
create or replace function public.manage_admin_toasts(p_input jsonb) returns jsonb
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
  if c.deleted_at is null then
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

commit;
