-- Run after the migration in a transaction as postgres. All observations roll back.
begin;
do $$
declare
  first_user uuid;
  second_user uuid;
  seen timestamptz;
  denied boolean;
begin
  select id into strict first_user from public.profiles
    where invite_verified_at is not null and name_confirmed order by id limit 1;
  select id into strict second_user from public.profiles
    where invite_verified_at is not null and name_confirmed and id <> first_user order by id limit 1;
  -- Existing member IDs are used only within this rolled-back transaction.
  insert into public.user_app_versions(user_id,platform,app_version,build_version,app_variant)
    values(second_user,'android','1.0.2','3','production')
    on conflict(user_id) do update set app_version = excluded.app_version;
  perform set_config('request.jwt.claim.sub', first_user::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.report_app_version('android','1.0.2','3',null,'runtime',true,null,'production');
  select last_seen_at into strict seen from public.user_app_versions where user_id = first_user;
  perform public.report_app_version('web','1.0.2',null,null,null,null,repeat('a',40),'production');
  assert (select count(*) = 1 from public.user_app_versions), 'RLS must hide other users';
  assert (select platform = 'web' and build_version is null and last_seen_at >= seen
    from public.user_app_versions where user_id = first_user), 'latest report must replace the prior observation';
  update public.user_app_versions set last_seen_at = '2000-01-01' where user_id = first_user;
  assert (select last_seen_at > '2026-01-01' from public.user_app_versions where user_id = first_user),
    'timestamp must be supplied by the server';
  update public.user_app_versions set app_version = '9.9.9' where user_id = second_user;
  assert not found, 'other user update must be hidden';
  denied := false;
  begin
    insert into public.user_app_versions(user_id,platform,app_version,build_version,app_variant)
      values(second_user,'android','9.9.9','3','production');
  exception when insufficient_privilege then denied := true;
  end;
  assert denied, 'other user insert must be denied';
  denied := false;
  begin
    perform public.report_app_version('web','1.0.2',null,null,null,null,null,'production');
  exception when check_violation then denied := true;
  end;
  assert denied, 'web observations require a build ID';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
  denied := false;
  begin
    perform public.report_app_version('android','1.0.2','3',null,null,null,null,'production');
  exception when insufficient_privilege then denied := true;
  end;
  assert denied, 'incomplete admission must be denied';
  perform set_config('role', 'anon', true);
  denied := false;
  begin
    perform public.report_app_version('android','1.0.2','3',null,null,null,null,'production');
  exception when insufficient_privilege then denied := true;
  end;
  assert denied, 'unauthenticated callers must be denied';
  perform set_config('role', 'postgres', true);
end;
$$;
rollback;
