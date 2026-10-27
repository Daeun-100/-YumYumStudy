begin;
create table public.room_postits (
 id uuid primary key,
 room_id smallint not null references public.study_room(id),
 author_id uuid not null references public.profiles(id),
 author text not null,
 text text not null check (char_length(btrim(text)) between 1 and 50),
 color text not null check (color in ('#F9E8A0','#F7CED4','#DAE8BE')),
 x double precision not null check (x between 0 and 1),
 y double precision not null check (y between 0 and 1),
 study_date date not null,
 created_at timestamptz not null default clock_timestamp(),
 deleted_at timestamptz
);
create index room_postits_today on public.room_postits(room_id, study_date, created_at);
alter table public.room_postits enable row level security;
revoke all on public.room_postits from public, anon, authenticated;

-- Only the database can publish. Clients may receive their admitted room's events.
create policy "Receive room postits" on realtime.messages for select to authenticated
 using (extension='broadcast' and realtime.topic()='postits:room:' || public.current_study_room()::text);
create function public.broadcast_room_postit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform realtime.send(to_jsonb(NEW), 'postit', 'postits:room:' || NEW.room_id::text, true);
 return null;
end $$;
create trigger room_postit_changed after insert or update on public.room_postits
 for each row execute function public.broadcast_room_postit();

create function public.get_room_postits() returns jsonb
language plpgsql security definer set search_path='' as $$
declare r smallint:=public.current_study_room(); d date:=public.study_date(statement_timestamp());
begin
 if r is null then raise exception 'Room admission required' using errcode='42501'; end if;
 return jsonb_build_object('date',d,'notes',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at,p.id) from public.room_postits p where p.room_id=r and p.study_date=d and p.deleted_at is null),'[]'::jsonb));
end $$;
create function public.put_room_postit(p_id uuid,p_text text,p_color text,p_x double precision,p_y double precision) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r smallint:=public.current_study_room(); n public.room_postits; d date:=public.study_date(statement_timestamp());
begin
 if r is null then raise exception 'Room admission required' using errcode='42501'; end if;
 -- Serialize submissions per author, including duplicate retries.
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into n from public.room_postits where id=p_id;
 if found then
  if n.author_id<>auth.uid() or n.room_id<>r then raise exception 'Invalid note' using errcode='42501'; end if;
  return to_jsonb(n);
 end if;
 if (select count(*) from public.room_postits where author_id=auth.uid() and study_date=d)>=30 then
  raise exception '오늘은 포스트잇을 30개까지 남길 수 있어요.' using errcode='22023';
 end if;
 insert into public.room_postits(id,room_id,author_id,author,text,color,x,y,study_date)
 select p_id,r,id,display_name,btrim(p_text),p_color,p_x,p_y,d from public.profiles where id=auth.uid()
 returning * into n;
 return to_jsonb(n);
end $$;
create function public.delete_room_postit(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r smallint:=public.current_study_room(); n public.room_postits;
begin
 if r is null then raise exception 'Room admission required' using errcode='42501'; end if;
 update public.room_postits set deleted_at=coalesce(deleted_at,clock_timestamp())
 where id=p_id and room_id=r and study_date=public.study_date(statement_timestamp()) returning * into n;
 if not found then raise exception '이 포스트잇은 더 이상 사용할 수 없어요.' using errcode='22023'; end if;
 return to_jsonb(n);
end $$;
revoke all on function public.broadcast_room_postit(),public.get_room_postits(),public.put_room_postit(uuid,text,text,double precision,double precision),public.delete_room_postit(uuid) from public,anon,authenticated;
grant execute on function public.get_room_postits(),public.put_room_postit(uuid,text,text,double precision,double precision),public.delete_room_postit(uuid) to authenticated;
commit;
