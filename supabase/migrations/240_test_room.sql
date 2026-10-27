-- One Supabase project, separate test (0) and live (1) identities.
-- Existing profiles and records stay in room 1. Never move an existing UID.
begin;
alter table public.study_room drop constraint study_room_id_check;
alter table public.study_room add constraint study_room_id_check check (id in (0, 1));
alter table public.profiles drop constraint profiles_room_id_check;
alter table public.profiles add constraint profiles_room_id_check check (room_id in (0, 1));
alter table public.study_sessions drop constraint study_sessions_room_id_check;
alter table public.study_sessions add constraint study_sessions_room_id_check check (room_id in (0, 1));
insert into public.study_room(id,name) values (0,'얌얌스터디 테스트');

-- SECURITY DEFINER avoids recursive profiles RLS. Only returns the caller's room.
create function public.current_study_room() returns smallint
language sql stable security definer set search_path = '' as $$
  select room_id from public.profiles where id = auth.uid();
$$;
revoke all on function public.current_study_room() from public,anon,authenticated;
grant execute on function public.current_study_room() to authenticated;

alter policy "Read fixed room" on public.study_room using (id = public.current_study_room());
alter policy "Read room profiles" on public.profiles using (room_id = public.current_study_room());
alter policy "Read room sessions" on public.study_sessions using (room_id = public.current_study_room());
alter policy "Read room goals" on public.goal_versions using (
  exists(select 1 from public.profiles p where p.id = user_id and p.room_id = public.current_study_room()));

create function public.ensure_profile(p_room_id smallint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_profile public.profiles;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_room_id is null or p_room_id not in (0,1) then raise exception 'Invalid room' using errcode = '22023'; end if;
  insert into public.profiles(id,room_id,display_name) values(v_uid,p_room_id,'공부친구-' || left(v_uid::text,8))
    on conflict (id) do nothing;
  select * into strict v_profile from public.profiles where id=v_uid;
  if v_profile.room_id <> p_room_id then raise exception 'Room identity mismatch' using errcode = '42501'; end if;
  return jsonb_build_object('id',v_profile.id,'displayName',v_profile.display_name);
end;
$$;
revoke all on function public.ensure_profile(smallint) from public,anon,authenticated;
grant execute on function public.ensure_profile(smallint) to authenticated;

-- Keep older production clients working.
create or replace function public.ensure_profile() returns jsonb
language sql security definer set search_path = '' as $$
  select public.ensure_profile(1::smallint);
$$;

-- Preserve the deployed goal/leave behavior while removing the fixed-room filter.
-- Only these known functions are changed; no historical records are rewritten.
do $migration$
declare signature text; definition text;
begin
  foreach signature in array array[
    'public.start_study(uuid)', 'public.stop_study(uuid)', 'public.get_today()',
    'public.get_room()', 'public.save_goals(integer[])', 'public._reconcile_leave_status()',
    'public.schedule_leave(uuid,date)', 'public.cancel_leave(uuid,date)',
    'public.mutate_leave(uuid,bigint,text,date,uuid)'
  ] loop
    definition := pg_get_functiondef(signature::regprocedure);
    definition := regexp_replace(definition, 'room_id\s*=\s*1', 'room_id = public.current_study_room()', 'g');
    if signature = 'public.start_study(uuid)' then
      if position('insert into public.study_sessions(user_id) values(v_uid)' in definition) = 0 then
        raise exception 'Unexpected start_study definition; review migration';
      end if;
      definition := replace(definition, 'insert into public.study_sessions(user_id) values(v_uid)',
        'insert into public.study_sessions(user_id, room_id) values(v_uid, public.current_study_room())');
    end if;
    execute definition;
  end loop;
end;
$migration$;
commit;
