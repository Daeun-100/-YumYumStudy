begin;
create table public.admin_notification_dispatches (
 id uuid primary key,
 payload_hash text not null,
 status text not null check (status in ('sending','completed')),
 summary jsonb not null,
 results jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now()
);
alter table public.admin_notification_dispatches enable row level security;
revoke all on public.admin_notification_dispatches from public,anon,authenticated;
grant select,insert,update on public.admin_notification_dispatches to service_role;
commit;
