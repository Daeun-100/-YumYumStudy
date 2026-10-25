-- Public release metadata only. No user data, no client-side writes.
begin;
create table public.app_releases (
  platform text primary key check (platform in ('android', 'web')),
  revision integer not null check (revision > 0),
  version text not null check (length(btrim(version)) > 0),
  notes text not null default '',
  download_url text,
  enabled boolean not null default false,
  check (download_url is null or download_url ~ '^https://'),
  check (not enabled or platform <> 'android' or download_url is not null)
);

alter table public.app_releases enable row level security;
revoke all on public.app_releases from anon, authenticated;
grant select on public.app_releases to anon, authenticated;
create policy "Read enabled releases" on public.app_releases
  for select to anon, authenticated using (enabled = true);

-- Publishing is a separate explicit step after deploying each artifact.
insert into public.app_releases (platform, revision, version, enabled)
values ('android', 1, '1.0.0', false), ('web', 1, '1.0.0', false);
commit;
