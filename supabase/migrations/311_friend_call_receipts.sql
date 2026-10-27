begin;
create table public.friend_call_receipts (
 ticket_id text primary key,
 call_id uuid not null references public.friend_calls(id) on delete cascade,
 device_id text not null references public.friend_call_devices(id) on delete cascade,
 checked_at timestamptz,
 error_code text
);
alter table public.friend_call_receipts enable row level security;
revoke all on public.friend_call_receipts from public,anon,authenticated;
grant all on public.friend_call_receipts to service_role;
commit;
