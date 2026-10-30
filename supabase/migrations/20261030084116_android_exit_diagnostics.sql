-- Reporter is the admitted user at next successful launch, not a claim about who was using
-- the process at exit. OS exit records can predate an account/room switch.
create table public.android_exit_diagnostics (
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  event_id uuid not null,
  room_id integer not null default public.current_study_room(),
  received_at timestamptz not null default clock_timestamp(),
  exited_at timestamptz not null,
  reason integer not null check (reason between 0 and 255),
  exit_status integer not null,
  importance integer not null check (importance between 0 and 10000),
  pss_kb bigint not null check (pss_kb >= 0),
  rss_kb bigint not null check (rss_kb >= 0),
  sdk integer not null check (sdk between 30 and 100),
  manufacturer text not null check (length(manufacturer) <= 128),
  model text not null check (length(model) <= 128),
  native_version text check (length(native_version) <= 32),
  native_build text check (native_build ~ '^[0-9]{1,32}$'),
  service_event text check (service_event in ('service_created', 'service_destroyed', 'task_removed')),
  service_at timestamptz,
  reporting_version text not null check (reporting_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$' and length(reporting_version) <= 32),
  reporting_build text not null check (reporting_build ~ '^[0-9]{1,32}$'),
  update_id uuid,
  primary key (reporter_id, event_id)
);
create index android_exit_diagnostics_room_received on public.android_exit_diagnostics(room_id, received_at desc);
alter table public.android_exit_diagnostics enable row level security;
revoke all on public.android_exit_diagnostics from public, anon, authenticated;
grant select, insert on public.android_exit_diagnostics to authenticated;
grant all on public.android_exit_diagnostics to service_role;
create policy "Read own exit reports" on public.android_exit_diagnostics for select to authenticated
using (reporter_id = (select auth.uid()) and room_id = (select public.current_study_room()));
create policy "Insert own exit reports" on public.android_exit_diagnostics for insert to authenticated
with check (reporter_id = (select auth.uid()) and room_id = (select public.current_study_room()));

create function public.report_android_exit(p_event jsonb, p_version text, p_build text, p_update_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or public.current_study_room() is null then
    raise exception 'Completed admission required' using errcode = '42501';
  end if;
  if p_event is null or jsonb_typeof(p_event) <> 'object' or octet_length(p_event::text) > 4096 then
    raise exception 'Invalid exit diagnostic' using errcode = '22023';
  end if;
  insert into public.android_exit_diagnostics (
    event_id, exited_at, reason, exit_status, importance, pss_kb, rss_kb, sdk, manufacturer, model,
    native_version, native_build, service_event, service_at, reporting_version, reporting_build, update_id
  ) values (
    (p_event->>'id')::uuid, to_timestamp((p_event->>'exitedAt')::double precision / 1000),
    (p_event->>'reason')::integer, (p_event->>'status')::integer, (p_event->>'importance')::integer,
    (p_event->>'pssKb')::bigint, (p_event->>'rssKb')::bigint, (p_event->>'sdk')::integer,
    p_event->>'manufacturer', p_event->>'model', p_event->>'nativeVersion', p_event->>'nativeBuild',
    p_event->>'serviceEvent', to_timestamp((p_event->>'serviceAt')::double precision / 1000),
    p_version, p_build, p_update_id
  ) on conflict (reporter_id, event_id) do nothing;
end;
$$;
revoke all on function public.report_android_exit(jsonb,text,text,uuid) from public, anon, authenticated;
grant execute on function public.report_android_exit(jsonb,text,text,uuid) to authenticated;
