import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The CI-isolated PostgreSQL runtime is shared with the existing toast tests.
test('study time SQL approval, late stops, reward boundaries and access control', { skip: !process.env.PGLITE_MODULE }, async () => {
  const { PGlite } = await import(process.env.PGLITE_MODULE);
  const db = new PGlite();
  const read = name => readFileSync(new URL(`../supabase/${name}`, import.meta.url), 'utf8');
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table auth.users(id uuid primary key,aud text,role text);`);
    const core = read('migrations/100_study_core.sql');
    await db.exec(core.slice(0,core.indexOf('create function public.ensure_profile')).replace('begin;',''));
    await db.exec(`alter table public.profiles add column invite_verified_at timestamptz;
      alter table public.profiles add column name_confirmed boolean default false;
      create function public.current_study_room() returns smallint language sql as $$select 1::smallint$$;
      create function public._require_admission() returns void language plpgsql as $$begin if auth.uid() is null then raise insufficient_privilege; end if; end$$;
      create function public.get_today() returns jsonb language sql as $$select jsonb_build_object('serverNow',clock_timestamp(),'data',jsonb_build_object('day',public._day_record(auth.uid(),public.study_date(clock_timestamp()),clock_timestamp())))$$;`);
    await db.exec(read('migrations/290_android_auto_pause.sql'));
    await db.exec(read('migrations/20261102102738_study_time_confirmation.sql'));
    await db.exec(read('tests/study_time_confirmation.sql'));
    await db.exec('set role anon');
    await assert.rejects(db.query('select public.confirm_study_time(null,null)'),/permission denied/);
    await db.exec('reset role; set role authenticated');
    await assert.rejects(db.exec("update public.study_sessions set confirmed_through=now()"),/permission denied/);
    await assert.rejects(db.query('select public.confirm_study_time(null,null)'),/insufficient_privilege/);
    await db.exec('reset role');
    const uid='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
    const sid='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
    await db.exec(`insert into auth.users(id) values('${uid}'); insert into public.profiles(id,display_name) values('${uid}','time-role-test');
      insert into public.study_sessions(id,user_id,started_at) values('${sid}','${uid}',now()-interval '10 minutes');
      grant usage on schema auth to authenticated; set role authenticated;
      select set_config('request.jwt.claim.sub','${uid}',false);`);
    await db.query('select public.confirm_study_time($1,clock_timestamp())',[sid]);
    await assert.rejects(db.exec(`update public.study_sessions set confirmed_through=null where id='${sid}'`),/permission denied/);
    await db.exec('reset role');
  } finally { await db.close(); }
});
