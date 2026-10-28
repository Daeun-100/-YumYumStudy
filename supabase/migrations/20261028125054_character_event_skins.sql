begin;

create schema if not exists private;
create table public.character_skins (
 id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
 name text not null check (char_length(btrim(name)) between 1 and 60),
 character text not null check (character in ('bunny','bear','cat','puppy','maltese','pomeranian','blackcat')),
 grant_enabled boolean not null default false,
 created_at timestamptz not null default clock_timestamp()
);
create table public.user_skins (
 user_id uuid not null references public.profiles(id) on delete cascade,
 skin_id text not null references public.character_skins(id),
 granted_at timestamptz not null default clock_timestamp(),
 granted_by uuid references auth.users(id) on delete set null,
 primary key (user_id,skin_id)
);
create index user_skins_skin_id_idx on public.user_skins(skin_id);
create index user_skins_granted_by_idx on public.user_skins(granted_by) where granted_by is not null;
alter table public.character_skins enable row level security;
alter table public.user_skins enable row level security;
revoke all on public.character_skins, public.user_skins from anon, authenticated;
grant select on public.character_skins, public.user_skins to authenticated;
grant all on public.character_skins, public.user_skins to service_role;
create policy "Read own skins" on public.user_skins for select to authenticated using (
 user_id = (select auth.uid()) and (select public.current_study_room()) is not null
);
create policy "Read owned skin definitions" on public.character_skins for select to authenticated using (
 exists(select 1 from public.user_skins s where s.skin_id = id and s.user_id = (select auth.uid()))
);

alter table public.profiles add column active_skin_id text,
 add column skin_updated_at timestamptz not null default clock_timestamp(),
 add constraint profiles_owned_skin_fk foreign key(id,active_skin_id) references public.user_skins(user_id,skin_id);

-- Keep the character/skin pair valid even for trusted maintenance SQL.
create function private.validate_profile_skin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if new.active_skin_id is not null and not exists (
   select 1 from public.character_skins s where s.id=new.active_skin_id and s.character=new.character
 ) then
   if new.character is distinct from old.character and new.active_skin_id is not distinct from old.active_skin_id then
     new.active_skin_id := null;
   else raise exception 'Skin character mismatch' using errcode='22023'; end if;
 end if;
 if new.character is distinct from old.character or new.active_skin_id is distinct from old.active_skin_id
   or new.display_name is distinct from old.display_name then new.skin_updated_at := clock_timestamp(); end if;
 return new;
end; $$;
revoke all on function private.validate_profile_skin() from public,anon,authenticated;
create trigger validate_profile_skin before update on public.profiles for each row execute function private.validate_profile_skin();

create function private.skin_profile_json(p public.profiles) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',p.id,'displayName',p.display_name,'character',p.character,
 'activeSkinId',p.active_skin_id,'skinUpdatedAt',p.skin_updated_at);
$$;
revoke all on function private.skin_profile_json(public.profiles) from public,anon,authenticated;

-- Locked owner profile is the serialization point shared by profile edits,
-- user skin selection and administrator operations.
create function private.apply_owner_skin(p_skin_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; c text;
begin
 perform public._require_admission();
 select * into strict p from public.profiles where id=auth.uid() for update;
 if p_skin_id is not null then
  select s.character into c from public.user_skins u join public.character_skins s on s.id=u.skin_id
   where u.user_id=p.id and u.skin_id=p_skin_id;
  if not found then raise exception 'Skin not owned' using errcode='22023'; end if;
 else c := p.character; end if;
 update public.profiles set character=c,active_skin_id=p_skin_id where id=p.id returning * into p;
 return private.skin_profile_json(p);
end; $$;
revoke all on function private.apply_owner_skin(text) from public,anon,authenticated;
grant usage on schema private to authenticated,service_role;
grant execute on function private.apply_owner_skin(text) to authenticated;
create function public.apply_my_skin(p_skin_id text) returns jsonb
language sql security invoker set search_path='' as $$ select private.apply_owner_skin(p_skin_id); $$;
revoke all on function public.apply_my_skin(text) from public,anon,authenticated;
grant execute on function public.apply_my_skin(text) to authenticated;

create function private.owner_skin_collection() returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; items jsonb;
begin
 perform public._require_admission();
 select * into strict p from public.profiles where id=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'character',s.character,
 'grantedAt',u.granted_at) order by u.granted_at,s.id),'[]'::jsonb) into items
 from public.user_skins u join public.character_skins s on s.id=u.skin_id where u.user_id=p.id;
 return jsonb_build_object('profile',private.skin_profile_json(p),'skins',items);
end; $$;
revoke all on function private.owner_skin_collection() from public,anon,authenticated;
grant execute on function private.owner_skin_collection() to authenticated;
create function public.get_my_skins() returns jsonb
language sql security invoker set search_path='' as $$ select private.owner_skin_collection(); $$;
revoke all on function public.get_my_skins() from public,anon,authenticated;
grant execute on function public.get_my_skins() to authenticated;

-- Trusted operator only; no service key or privileged operation in the app.
create function public.admin_grant_skin(p_user_id uuid,p_skin_id text,p_room_id smallint,p_apply boolean default false,p_granted_by uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.profiles; c text;
begin
 select * into p from public.profiles where id=p_user_id and room_id=p_room_id
  and invite_verified_at is not null and name_confirmed for update;
 if not found then raise exception 'Admitted profile in selected room required' using errcode='22023'; end if;
 select character into c from public.character_skins where id=p_skin_id and grant_enabled;
 if not found then raise exception 'Skin not available for grant' using errcode='22023'; end if;
 insert into public.user_skins(user_id,skin_id,granted_by) values(p.id,p_skin_id,p_granted_by) on conflict do nothing;
 if p_apply then update public.profiles set character=c,active_skin_id=p_skin_id where id=p.id returning * into p; end if;
 return private.skin_profile_json(p);
end; $$;
create function public.admin_apply_skin(p_user_id uuid,p_skin_id text,p_room_id smallint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.profiles; c text;
begin
 select * into p from public.profiles where id=p_user_id and room_id=p_room_id
  and invite_verified_at is not null and name_confirmed for update;
 if not found then raise exception 'Admitted profile in selected room required' using errcode='22023'; end if;
 if p_skin_id is null then c:=p.character;
 else
  select s.character into c from public.user_skins u join public.character_skins s on s.id=u.skin_id where u.user_id=p.id and s.id=p_skin_id;
  if not found then raise exception 'Skin not owned' using errcode='22023'; end if;
 end if;
 update public.profiles set character=c,active_skin_id=p_skin_id where id=p.id returning * into p;
 return private.skin_profile_json(p);
end; $$;
revoke all on function public.admin_grant_skin(uuid,text,smallint,boolean,uuid),public.admin_apply_skin(uuid,text,smallint) from public,anon,authenticated;
grant execute on function public.admin_grant_skin(uuid,text,smallint,boolean,uuid),public.admin_apply_skin(uuid,text,smallint),private.skin_profile_json(public.profiles) to service_role;

-- Additive JSON fields preserve old clients. Reuse existing admission/study code.
do $migration$
declare sig text; definition text; changed text;
begin
 foreach sig in array array['public.get_onboarding(smallint)','public.get_today()','public.get_room()','public.set_profile(text,text)'] loop
  definition := pg_get_functiondef(sig::regprocedure);
  changed := regexp_replace(definition,'''displayName'',\s*(p|v_profile)\.display_name',
   '''displayName'', \1.display_name, ''activeSkinId'', \1.active_skin_id, ''skinUpdatedAt'', \1.skin_updated_at','g');
  if changed=definition then raise exception 'Profile JSON not found: %',sig; end if;
  execute changed;
 end loop;
end; $migration$;

-- Catalog entry starts disabled; enable only after validating OTA delivery.
insert into public.character_skins(id,name,character,grant_enabled) values('bunny-toothache','치통 토끼','bunny',false);
commit;
