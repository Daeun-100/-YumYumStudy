begin;
-- Existing UIDs keep admission and records, but choose a name once.
alter table public.profiles add column invite_verified_at timestamptz;
alter table public.profiles add column name_confirmed boolean not null default false;
update public.profiles set invite_verified_at=clock_timestamp();
create table public.room_invites(room_id smallint primary key references public.study_room(id), code_hash text);
insert into public.room_invites(room_id) values(1);
create table public.invite_attempts(user_id uuid primary key references auth.users(id) on delete cascade, attempted_at timestamptz not null, attempts integer not null);
alter table public.room_invites enable row level security;
alter table public.invite_attempts enable row level security;
revoke all on public.room_invites,public.invite_attempts from public,anon,authenticated;

create or replace function public.current_study_room() returns smallint
language sql stable security definer set search_path='' as $$
 select room_id from public.profiles where id=auth.uid() and invite_verified_at is not null and name_confirmed;
$$;
create function public.get_onboarding(p_room_id smallint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.profiles;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_room_id is null or p_room_id not in (0,1) then raise exception 'Invalid room' using errcode='22023'; end if;
 select * into p from public.profiles where id=auth.uid();
 if found and p.room_id<>p_room_id then raise exception 'Room identity mismatch' using errcode='42501'; end if;
 if p.invite_verified_at is null then return jsonb_build_object('step','invite','profile',null); end if;
 return jsonb_build_object('step',case when p.name_confirmed then 'ready' else 'name' end,
 'profile',jsonb_build_object('id',p.id,'displayName',p.display_name));
end; $$;

create function public.join_room(p_room_id smallint,p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); p public.profiles; h text; n timestamptz:=clock_timestamp(); a public.invite_attempts;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_room_id is null or p_room_id not in (0,1) then raise exception 'Invalid room' using errcode='22023'; end if;
 -- Serialize retries, including two simultaneous first joins.
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select * into p from public.profiles where id=u;
 if found then
  if p.room_id<>p_room_id then raise exception 'Room identity mismatch' using errcode='42501'; end if;
  if p.invite_verified_at is not null then return public.get_onboarding(p_room_id); end if;
 end if;
 if p_room_id=1 then
  select code_hash into h from public.room_invites where room_id=1;
  if h is null then return jsonb_build_object('error','INVITE_NOT_CONFIGURED'); end if;
  insert into public.invite_attempts(user_id,attempted_at,attempts) values(u,n,1)
  on conflict(user_id) do update set
   attempts=case when invite_attempts.attempted_at<=n-interval '15 minutes' then 1 else invite_attempts.attempts+1 end,
   attempted_at=case when invite_attempts.attempted_at<=n-interval '15 minutes' then n else invite_attempts.attempted_at end
  returning * into a;
  if a.attempts>5 then return jsonb_build_object('error','RATE_LIMITED'); end if;
  if p_code is null or length(p_code)>128 or extensions.crypt(p_code,h)<>h then
   return jsonb_build_object('error','INVALID_INVITE');
  end if;
 end if;
 insert into public.profiles(id,room_id,display_name,invite_verified_at) values(u,p_room_id,'공부친구-'||left(u::text,8),n)
 on conflict(id) do update set invite_verified_at=n;
 return public.get_onboarding(p_room_id);
end; $$;

create function public.set_display_name(p_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; v text:=btrim(p_name);
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if v is null or char_length(v) not between 1 and 12 or v ~ '[[:cntrl:]]' then raise exception 'Invalid display name' using errcode='22023'; end if;
 update public.profiles set display_name=v,name_confirmed=true where id=auth.uid() and invite_verified_at is not null returning * into p;
 if not found then raise exception 'Admission required' using errcode='42501'; end if;
 return public.get_onboarding(p.room_id);
end; $$;

-- Legacy profile RPCs must never auto-admit a production user.
create or replace function public.ensure_profile(p_room_id smallint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb;
begin
 s:=public.get_onboarding(p_room_id);
 if s->>'step'<>'ready' then raise exception 'Onboarding required' using errcode='42501'; end if;
 return s->'profile';
end; $$;

-- Gate every externally callable study RPC, including SECURITY DEFINER reads.
create function public._require_admission() returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if public.current_study_room() is null then raise exception 'Onboarding required' using errcode='42501'; end if;
end; $$;
do $migration$
declare sig text; definition text;
begin
 foreach sig in array array['public.start_study(uuid)','public.stop_study(uuid)','public.get_today()',
 'public.get_room()','public.get_goals()','public.get_history(date,date)','public.save_goals(integer[])',
 'public.get_goal_settings()','public.get_leave_status()','public.mutate_leave(uuid,bigint,text,date,uuid)'] loop
  definition:=pg_get_functiondef(sig::regprocedure);
  if definition !~* E'\\mbegin\\M' then raise exception 'Unexpected RPC definition: %',sig; end if;
  definition:=regexp_replace(definition,E'\\mbegin\\M',E'begin\n perform public._require_admission();','i');
  execute definition;
 end loop;
end; $migration$;
alter policy "Read own leave grants" on public.leave_grants using (user_id=auth.uid() and public.current_study_room() is not null);
revoke all on function public._require_admission() from public,anon,authenticated;
revoke all on function public.get_onboarding(smallint),public.join_room(smallint,text),public.set_display_name(text) from public,anon,authenticated;
grant execute on function public.get_onboarding(smallint),public.join_room(smallint,text),public.set_display_name(text) to authenticated;
commit;
