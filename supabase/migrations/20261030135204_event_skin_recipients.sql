begin;
-- Optional user_ids narrows the immutable recipient snapshot. Omission preserves room-wide grants.
create or replace function private.schedule_event_local(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.event_jobs; old private.event_jobs; jid uuid:=(p->>'request_id')::uuid;
 room smallint:=(p->>'room_id')::smallint; kind text:=p->>'kind'; at_time timestamptz:=(p->>'run_at')::timestamptz;
 end_time timestamptz:=nullif(p->>'ends_at','')::timestamptz; rec uuid[]; requested uuid[]; skins text[]; scr text[];
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
 if p ? 'user_ids' then
  if kind <> 'grant_skins' or jsonb_typeof(p->'user_ids') is distinct from 'array' then
   raise exception 'user_ids requires a skin grant and a nonempty UUID array' using errcode='22023';
  end if;
  if jsonb_array_length(p->'user_ids') not between 1 and 500 then
   raise exception 'Choose between 1 and 500 recipients' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p->'user_ids') x where jsonb_typeof(x) is distinct from 'string'
    or (x #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
   raise exception 'Recipient UUIDs required' using errcode='22023';
  end if;
  select array_agg(distinct x::uuid order by x::uuid) into requested from jsonb_array_elements_text(p->'user_ids') x;
  if cardinality(requested) <> jsonb_array_length(p->'user_ids') then
   raise exception 'Duplicate recipients are not allowed' using errcode='22023';
  end if;
 end if;
 if kind='grant_skins' then
  select array_agg(distinct x order by x) into skins from jsonb_array_elements_text(p->'skin_ids') x;
  if coalesce(cardinality(skins),0)=0 or cardinality(skins)>40 or end_time is not null then raise exception 'Skin list required' using errcode='22023'; end if;
  if exists(select 1 from unnest(skins) x left join public.character_skins s on s.id=x where s.id is null or not s.grant_enabled) then raise exception 'Skin unavailable' using errcode='22023'; end if;
  if replacement is not null then
   rec:=old.recipients;
   if requested is not null and requested is distinct from rec then
    raise exception 'Replacement must preserve original recipients' using errcode='22023';
   end if;
  elsif requested is not null then
   select array_agg(id order by id) into rec from public.profiles
    where id=any(requested) and room_id=room and invite_verified_at is not null and name_confirmed;
   if rec is distinct from requested then
    raise exception 'Every selected recipient must be an admitted member of the requested room' using errcode='22023';
   end if;
  else
   select array_agg(id order by id) into rec from public.profiles where room_id=room and invite_verified_at is not null and name_confirmed;
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

revoke all on function private.schedule_event_local(jsonb) from public,anon,authenticated,service_role;
commit;
