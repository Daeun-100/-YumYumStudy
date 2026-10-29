begin;

-- Public artwork bucket. Only trusted operators may upload; URL holders may
-- download artwork. A restrictive policy protects this bucket even if an older
-- permissive policy exists for another Storage feature.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('room-banners','room-banners',true,2097152,array['image/png']);
create policy "Room banner operator writes only" on storage.objects as restrictive
 for all to anon,authenticated using (bucket_id <> 'room-banners')
 with check (bucket_id <> 'room-banners');

-- One image pair and one shared schedule per room.
create table public.room_banners (
 room_id smallint primary key references public.study_room(id),
 home_image_path text not null check (home_image_path ~ ('^rooms/' || room_id::text || '/[0-9a-f-]{36}/home[.]png$')),
 focus_image_path text not null check (focus_image_path ~ ('^rooms/' || room_id::text || '/[0-9a-f-]{36}/focus[.]png$')),
 alt_text text not null check (alt_text = btrim(alt_text) and char_length(alt_text) between 1 and 160 and alt_text !~ '[[:cntrl:]]'),
 enabled boolean not null default false,
 starts_at timestamptz not null default statement_timestamp() check (isfinite(starts_at)),
 ends_at timestamptz check (ends_at is null or (isfinite(ends_at) and ends_at > starts_at)),
 updated_at timestamptz not null default clock_timestamp()
);
alter table public.room_banners enable row level security;
revoke all on public.room_banners from public, anon, authenticated;
grant select on public.room_banners to authenticated;
grant select, insert, update on public.room_banners to service_role;
create policy "Read own room banner" on public.room_banners for select to authenticated using (
 enabled and room_id = (select public.current_study_room())
);

create function private.stamp_room_banner() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 new.updated_at := clock_timestamp();
 return new;
end; $$;
revoke all on function private.stamp_room_banner() from public,anon,authenticated;
create trigger stamp_room_banner before insert or update on public.room_banners
 for each row execute function private.stamp_room_banner();

-- Trusted operator only. Default start is immediate, null end means indefinite.
create function public.admin_publish_room_banner(p_room_id smallint, p_home_image_path text, p_focus_image_path text, p_alt_text text,
 p_starts_at timestamptz default statement_timestamp(), p_ends_at timestamptz default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare banner public.room_banners;
begin
 if not exists(select 1 from storage.objects where bucket_id='room-banners' and name=p_home_image_path)
  or not exists(select 1 from storage.objects where bucket_id='room-banners' and name=p_focus_image_path) then
  raise exception 'Both banner images must be uploaded before publishing' using errcode='22023';
 end if;
 insert into public.room_banners(room_id,home_image_path,focus_image_path,alt_text,enabled,starts_at,ends_at)
 values(p_room_id,p_home_image_path,p_focus_image_path,btrim(p_alt_text),true,p_starts_at,p_ends_at)
 on conflict(room_id) do update set home_image_path=excluded.home_image_path,
 focus_image_path=excluded.focus_image_path,alt_text=excluded.alt_text,enabled=true,
 starts_at=excluded.starts_at,ends_at=excluded.ends_at returning * into banner;
 return to_jsonb(banner);
end; $$;
create function public.admin_hide_room_banner(p_room_id smallint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare banner public.room_banners;
begin
 if p_room_id is null or not exists(select 1 from public.study_room where id=p_room_id) then
  raise exception 'Invalid room' using errcode='22023';
 end if;
 update public.room_banners set enabled=false where room_id=p_room_id returning * into banner;
 return case when found then to_jsonb(banner) else null end;
end; $$;
revoke all on function public.admin_publish_room_banner(smallint,text,text,text,timestamptz,timestamptz),
 public.admin_hide_room_banner(smallint) from public,anon,authenticated;
grant execute on function public.admin_publish_room_banner(smallint,text,text,text,timestamptz,timestamptz),
 public.admin_hide_room_banner(smallint) to service_role;
grant select on public.study_room to service_role;

-- Additive field: preserve every existing study/profile field and admission check.
-- Include future and expired enabled schedules; the client uses serverNow to
-- decide startsAt <= now < endsAt without extra polling or a cron job.
do $migration$
declare definition text; changed text; target regprocedure;
begin
 -- Newer develop wraps the snapshot with reward reconciliation. Patch the
 -- underlying snapshot when present, leaving that wrapper and its locks intact.
 target := coalesce(to_regprocedure('public._today_before_super_watermelon()'),
  'public.get_today()'::regprocedure);
 definition := pg_get_functiondef(target);
 changed := replace(definition, '''activeSession'', v_active',
 $replacement$'activeSession', v_active, 'roomBanner', (
  select jsonb_build_object('roomId',b.room_id,'homeImagePath',b.home_image_path,'focusImagePath',b.focus_image_path,
   'altText',b.alt_text,'enabled',b.enabled,
   'startsAt',b.starts_at,'endsAt',b.ends_at,'updatedAt',b.updated_at)
  from public.room_banners b where b.room_id=v_profile.room_id and b.enabled
 )$replacement$);
 if changed=definition then raise exception 'get_today snapshot anchor not found'; end if;
 execute changed;
end; $migration$;

comment on table public.room_banners is 'Operator-managed shared home/focus banner, one schedule per room. No cron or client writes.';
commit;
