begin;
alter table public.profiles drop constraint profiles_character_check;
alter table public.profiles add constraint profiles_character_check
 check (character in ('bunny','bear','cat','puppy','maltese','pomeranian','blackcat'));

create or replace function public.set_profile(p_name text,p_character text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; v text:=btrim(p_name);
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if v is null or char_length(v) not between 1 and 12 or v ~ '[[:cntrl:]]' then raise exception 'Invalid display name' using errcode='22023'; end if;
 if p_character is null or p_character not in ('bunny','bear','cat','puppy','maltese','pomeranian','blackcat') then raise exception 'Invalid character' using errcode='22023'; end if;
 update public.profiles set display_name=v,character=p_character,name_confirmed=true
 where id=auth.uid() and invite_verified_at is not null returning * into p;
 if not found then raise exception 'Admission required' using errcode='42501'; end if;
 return jsonb_build_object('id',p.id,'displayName',p.display_name,'character',p.character);
end; $$;
revoke all on function public.set_profile(text,text) from public,anon,authenticated;
grant execute on function public.set_profile(text,text) to authenticated;

commit;
