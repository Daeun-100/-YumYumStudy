begin;
-- A member is shown to friends after completing their name.
alter policy "Read room profiles" on public.profiles using (room_id=public.current_study_room() and name_confirmed);
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.get_room()'::regprocedure);
 if position('where p.room_id = public.current_study_room()' in definition)=0 then raise exception 'Unexpected room query'; end if;
 definition:=replace(definition,'where p.room_id = public.current_study_room()','where p.room_id = public.current_study_room() and p.name_confirmed');
 execute definition;
end; $$;
commit;
