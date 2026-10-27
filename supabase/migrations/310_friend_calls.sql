begin;
create table public.friend_call_devices (
 id text primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 provider text not null check(provider in ('expo','web')),
 address jsonb not null,
 enabled boolean not null default true,
 updated_at timestamptz not null default clock_timestamp()
);
create index friend_call_devices_user on public.friend_call_devices(user_id) where enabled;
create table public.friend_calls (
 id uuid primary key,
 room_id smallint not null references public.study_room(id),
 sender_id uuid not null references public.profiles(id),
 recipient_id uuid not null references public.profiles(id),
 title text not null,
 message text not null check(char_length(btrim(message)) between 1 and 40),
 status text not null default 'pending' check(status in ('pending','accepted','failed','unknown')),
 accepted_count integer not null default 0,
 created_at timestamptz not null default clock_timestamp(),
 check(sender_id<>recipient_id)
);
create index friend_calls_cooldown on public.friend_calls(recipient_id,created_at desc);
alter table public.friend_calls enable row level security;
alter table public.friend_call_devices enable row level security;
revoke all on public.friend_calls,public.friend_call_devices from public,anon,authenticated;
grant all on public.friend_calls,public.friend_call_devices to service_role;

-- Only the authenticated Edge Function may register destinations and reserve sends.
create function public.register_friend_call_device(p_user uuid,p_room smallint,p_id text,p_provider text,p_address jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where id=p_user and room_id=p_room and invite_verified_at is not null and name_confirmed) then
  raise exception 'Room admission required' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,310));
 if (select count(*) from public.friend_call_devices where user_id=p_user and enabled and id<>p_id)>=5 then
  raise exception '등록 기기가 너무 많아요. 기존 기기의 알림을 해제해 주세요.' using errcode='22023';
 end if;
 insert into public.friend_call_devices(id,user_id,provider,address) values(p_id,p_user,p_provider,p_address)
 on conflict(id) do update set user_id=p_user,provider=p_provider,address=p_address,enabled=true,updated_at=clock_timestamp();
end $$;

create function public.reserve_friend_call(p_sender uuid,p_room smallint,p_recipient uuid,p_id uuid,p_message text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.friend_calls; sender_name text; msg text:=btrim(p_message);
begin
 select display_name into sender_name from public.profiles where id=p_sender and room_id=p_room and invite_verified_at is not null and name_confirmed;
 if not found then raise exception 'Room admission required' using errcode='42501'; end if;
 if p_recipient=p_sender or not exists(select 1 from public.profiles where id=p_recipient and room_id=p_room and invite_verified_at is not null and name_confirmed) then
  raise exception '같은 방 친구만 부를 수 있어요.' using errcode='42501';
 end if;
 if msg is null or char_length(msg) not between 1 and 40 or msg ~ '[[:cntrl:]]' then
  raise exception '메시지는 줄바꿈 없이 1~40자로 입력해 주세요.' using errcode='22023';
 end if;
 -- A single request gets one dispatch, even across concurrent HTTP retries.
 perform pg_advisory_xact_lock(hashtextextended(p_recipient::text,311));
 select * into c from public.friend_calls where id=p_id;
 if found then
  if c.sender_id<>p_sender or c.recipient_id<>p_recipient or c.message<>msg or c.room_id<>p_room then
   raise exception 'Request ID reused' using errcode='22023';
  end if;
  return jsonb_build_object('dispatch',false,'call',to_jsonb(c));
 end if;
 if exists(select 1 from public.study_sessions where user_id=p_recipient and ended_at is null) then
  raise exception '이미 공부 중인 친구예요.' using errcode='22023';
 end if;
 if exists(select 1 from public.friend_calls where recipient_id=p_recipient and status<>'failed' and created_at>clock_timestamp()-interval '5 minutes') then
  raise exception '방금 부른 친구예요. 5분 뒤에 다시 불러 주세요.' using errcode='22023';
 end if;
 if not exists(select 1 from public.friend_call_devices where user_id=p_recipient and enabled) then
  raise exception '친구가 아직 부르기 알림을 켜지 않았어요.' using errcode='22023';
 end if;
 insert into public.friend_calls(id,room_id,sender_id,recipient_id,title,message)
 values(p_id,p_room,p_sender,p_recipient,sender_name||'님이 불렀어요!',msg) returning * into c;
 return jsonb_build_object('dispatch',true,'call',to_jsonb(c));
end $$;
revoke all on function public.register_friend_call_device(uuid,smallint,text,text,jsonb),public.reserve_friend_call(uuid,smallint,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.register_friend_call_device(uuid,smallint,text,text,jsonb),public.reserve_friend_call(uuid,smallint,uuid,uuid,text) to service_role;
commit;
