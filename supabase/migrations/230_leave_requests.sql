begin;
alter table public.profiles add column leave_revision bigint not null default 0 check(leave_revision>=0);
create table public.leave_requests (
 user_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null,
 payload jsonb not null,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(user_id,request_id)
);
alter table public.leave_requests enable row level security;
revoke all on public.leave_requests from public, anon, authenticated;

alter function public.get_leave_status() rename to _reconcile_leave_status;
revoke all on function public._reconcile_leave_status() from public,anon,authenticated;
create function public.get_leave_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public._reconcile_leave_status();
 return jsonb_set(result,'{data,revision}',to_jsonb((select leave_revision from public.profiles where id=auth.uid())));
end;
$$;
revoke all on function public.get_leave_status() from public,anon,authenticated;
grant execute on function public.get_leave_status() to authenticated;

create function public.mutate_leave(p_request_id uuid, p_revision bigint, p_action text, p_date date, p_grant_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); rev bigint; payload jsonb; previous jsonb; g uuid; n timestamptz;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select leave_revision into rev from public.profiles where id=u and room_id=1 for update;
 if not found then raise exception 'Profile required' using errcode='42501'; end if;
 if p_request_id is null or p_revision is null or p_revision<0 or p_action is null or p_action not in ('schedule','cancel') or p_date is null then
   raise exception 'Invalid leave request' using errcode='22023'; end if;
 payload:=jsonb_build_object('revision',p_revision,'action',p_action,'date',p_date,'grantId',p_grant_id);
 select r.payload into previous from public.leave_requests r where user_id=u and request_id=p_request_id;
 if found then
   if previous<>payload then raise exception 'Request ID reused with different input' using errcode='22023'; end if;
   return public.get_leave_status();
 end if;
 if rev<>p_revision then raise exception 'Leave changed; refresh before making a new request' using errcode='22023'; end if;
 perform public.get_leave_status();
 n:=clock_timestamp();
 if p_action='schedule' then
   g:=p_grant_id;
   if g is null then
     select id into g from public.leave_grants where user_id=u and scheduled_date is null and earned_at<=n
       and expires_at>n and expires_at>(p_date+time '06:00') at time zone 'Asia/Seoul'
       order by expires_at,earned_at,id limit 1;
     if g is null then raise exception 'No eligible leave' using errcode='22023'; end if;
   end if;
   perform public.schedule_leave(g,p_date);
 else
   if p_grant_id is null then raise exception 'Grant required for cancellation' using errcode='22023'; end if;
   perform public.cancel_leave(p_grant_id,p_date);
 end if;
 update public.profiles set leave_revision=leave_revision+1 where id=u;
 insert into public.leave_requests(user_id,request_id,payload) values(u,p_request_id,payload);
 return public.get_leave_status();
end;
$$;
-- Old unversioned entry points must not bypass stale-request protection.
revoke all on function public.schedule_leave(uuid,date), public.cancel_leave(uuid,date) from public,anon,authenticated;
revoke all on function public.mutate_leave(uuid,bigint,text,date,uuid) from public,anon,authenticated;
grant execute on function public.mutate_leave(uuid,bigint,text,date,uuid) to authenticated;
commit;
