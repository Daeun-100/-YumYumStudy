import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const modulePath = process.env.PGLITE_MODULE;
test('exit diagnostics: ownership, admission, idempotency and bounded typed payload', { skip: !modulePath }, async () => {
  const { PGlite } = await import(modulePath); const db = new PGlite();
  const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; grant usage on schema auth to authenticated;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
      create table public.profiles(id uuid primary key);
      insert into public.profiles values ('${a}'),('${b}');
      create function public.current_study_room() returns integer language sql stable as $$ select nullif(current_setting('test.room',true),'')::integer $$;`);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261030084116_android_exit_diagnostics.sql', import.meta.url), 'utf8'));
    const event = { id: '00000000-0000-4000-8000-000000000010', exitedAt: Date.now(), reason: 6, status: 0,
      importance: 400, pssKb: 123, rssKb: 456, sdk: 35, model: 'SM-S931N', manufacturer: 'samsung',
      nativeVersion: '1.1.0', nativeBuild: '4', serviceEvent: 'service_destroyed', serviceAt: Date.now()-1000 };
    const call = e => db.query('select public.report_android_exit($1::jsonb,$2,$3,null)', [JSON.stringify(e),'1.1.0','4']);
    await db.exec(`set role authenticated; select set_config('test.uid','${a}',false); select set_config('test.room','1',false);`);
    await call(event); await call(event);
    assert.equal((await db.query('select * from public.android_exit_diagnostics')).rows.length, 1);
    await assert.rejects(db.exec(`update public.android_exit_diagnostics set reason=1`), /permission denied/);
    await assert.rejects(db.exec(`delete from public.android_exit_diagnostics`), /permission denied/);
    await assert.rejects(call({ ...event, id: b, pssKb: -1 }), /check constraint/);
    await assert.rejects(call({ ...event, id: b, serviceEvent: 'token-or-private-text' }), /check constraint/);
    await assert.rejects(call({ ...event, id: b, model: 'a'.repeat(5000) }), /Invalid exit diagnostic/);
    await db.exec(`select set_config('test.uid','${b}',false)`);
    assert.equal((await db.query('select * from public.android_exit_diagnostics')).rows.length, 0);
    await assert.rejects(db.exec(`insert into public.android_exit_diagnostics select * from (values
      ('${a}'::uuid,'${b}'::uuid,1,now(),now(),1,0,400,0::bigint,0::bigint,35,'samsung','S25',null,null,null,null::timestamptz,'1.1.0','4',null::uuid)) as x`), /row-level security/);
    await db.exec("select set_config('test.room','',false)");
    await assert.rejects(call(event), /Completed admission required/);
    await db.exec('reset role; set role anon'); await assert.rejects(call(event), /permission denied/);
    await db.exec('reset role; set role service_role');
    assert.equal((await db.query('select * from public.android_exit_diagnostics')).rows.length, 1);
  } finally { await db.close(); }
});
