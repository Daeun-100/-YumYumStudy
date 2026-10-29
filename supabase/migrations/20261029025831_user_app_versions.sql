-- One latest observation per user, independent of push-notification permission.
create table public.user_app_versions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios', 'web')),
  app_version text not null check (app_version ~ '^\d+\.\d+\.\d+$' and length(app_version) <= 32),
  build_version text check (build_version ~ '^\d+$' and length(build_version) <= 32),
  update_id uuid,
  runtime_version text check (length(runtime_version) between 1 and 128),
  embedded boolean,
  web_build_id text check (web_build_id ~ '^[a-f0-9]{40}$'),
  app_variant text not null check (app_variant in ('production', 'test')),
  last_seen_at timestamptz not null default clock_timestamp(),
  constraint platform_version_fields check (
    (platform = 'web' and web_build_id is not null and build_version is null
      and update_id is null and runtime_version is null and embedded is null)
    or (platform in ('android', 'ios') and build_version is not null and web_build_id is null)
  )
);

alter table public.user_app_versions enable row level security;
revoke all on public.user_app_versions from public, anon, authenticated;
grant select, insert, update on public.user_app_versions to authenticated;
grant all on public.user_app_versions to service_role;

create policy "Read own app version" on public.user_app_versions
for select to authenticated
using (user_id = (select auth.uid()) and (select public.current_study_room()) is not null);
create policy "Insert own app version" on public.user_app_versions
for insert to authenticated
with check (user_id = (select auth.uid()) and (select public.current_study_room()) is not null);
create policy "Update own app version" on public.user_app_versions
for update to authenticated
using (user_id = (select auth.uid()) and (select public.current_study_room()) is not null)
with check (user_id = (select auth.uid()) and (select public.current_study_room()) is not null);

-- Override client timestamps even when the table is called directly via REST.
create function public.stamp_app_version_seen() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.last_seen_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.stamp_app_version_seen() from public, anon, authenticated;
create trigger stamp_app_version_seen before insert or update on public.user_app_versions
for each row execute function public.stamp_app_version_seen();

create function public.report_app_version(
  p_platform text, p_app_version text, p_build_version text,
  p_update_id uuid, p_runtime_version text, p_embedded boolean,
  p_web_build_id text, p_app_variant text
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or public.current_study_room() is null then
    raise exception 'Completed admission required' using errcode = '42501';
  end if;
  insert into public.user_app_versions (
    user_id, platform, app_version, build_version, update_id, runtime_version,
    embedded, web_build_id, app_variant
  ) values (
    auth.uid(), p_platform, p_app_version, p_build_version, p_update_id,
    p_runtime_version, p_embedded, p_web_build_id, p_app_variant
  ) on conflict (user_id) do update set
    platform = excluded.platform, app_version = excluded.app_version,
    build_version = excluded.build_version, update_id = excluded.update_id,
    runtime_version = excluded.runtime_version, embedded = excluded.embedded,
    web_build_id = excluded.web_build_id, app_variant = excluded.app_variant;
end;
$$;
revoke all on function public.report_app_version(text,text,text,uuid,text,boolean,text,text)
from public, anon, authenticated;
grant execute on function public.report_app_version(text,text,text,uuid,text,boolean,text,text)
to authenticated;
