// Isolated PostgreSQL verification. Install @electric-sql/pglite in a temporary
// directory and pass its dist/index.js path; no app dependency or remote writes.
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : '@electric-sql/pglite');
const db = new PGlite();
try {
 await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema extensions; create schema realtime;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 grant execute on function auth.uid() to anon,authenticated,service_role;
 alter default privileges in schema public grant all on tables to service_role;
 create table realtime.messages(extension text);
 alter table realtime.messages enable row level security;
 create function realtime.topic() returns text language sql as $$ select ''::text $$;
 create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$ select $$;
 create publication supabase_realtime;
 `);
 const files = (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort((a,b)=> {
  const x=BigInt(a.split('_')[0]), y=BigInt(b.split('_')[0]); return x<y?-1:x>y?1:a.localeCompare(b);
 });
 for (const file of files) {
  // Also exercise the deployed pre-reward snapshot shape without remote writes.
  if (process.argv.includes('--before-rewards') && file.includes('super_watermelon_rewards')) continue;
  // External scheduler/Vault are unrelated to banner behavior. Keep the weekly
  // leave function SQL, skipping only its pg_cron installation and scheduling.
  if (file.includes('scheduled_discord_log_monitor')) continue;
  let sql = await readFile(`supabase/migrations/${file}`,'utf8');
  sql=sql.replace(/create extension if not exists pg_cron;/gi,'').replace(/^select cron\.schedule\(.*$/gmi,'');
  try { await db.exec(sql); } catch(e) { throw new Error(`Migration ${file}: ${e.message}`); }
 }
 console.log('All application migrations replayed (external cron/Vault excluded).');
 await db.exec(`
 insert into auth.users(id) values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000003');
 insert into public.profiles(id,room_id,display_name,character,invite_verified_at,name_confirmed) values
 ('00000000-0000-4000-8000-000000000001',0,'친구1','bear',now(),true),
 ('00000000-0000-4000-8000-000000000002',1,'친구2','cat',now(),true),
 ('00000000-0000-4000-8000-000000000003',0,'미입장','bear',null,false);
 `);

 const user='00000000-0000-4000-8000-000000000001';
 const other='00000000-0000-4000-8000-000000000002';
 const unadmitted='00000000-0000-4000-8000-000000000003';
 async function role(roleName,uid,sql) {
  await db.exec(`set role ${roleName}; select set_config('request.jwt.claim.sub','${uid ?? ''}',false);`);
  try { return await db.query(sql); } finally { await db.exec('reset role;'); }
 }
 const asUser=sql=>role('authenticated',user,sql);
 const admin=sql=>role('service_role',null,sql);
 const today=async(uid=user)=>(await role('authenticated',uid,'select public.get_today() as t')).rows[0].t;
 assert.equal((await today()).data.roomBanner,null);
 const publish=`select public.admin_publish_room_banner(0::smallint,'  같이 달려요!  ','2026-11-01T06:00:00+09:00','2026-11-08T06:00:00+09:00') as b`;
 let saved=(await admin(publish)).rows[0].b;
 assert.equal(saved.message,'같이 달려요!');
 assert.equal(saved.enabled,true);
 let snapshot=await today();
 assert.equal(snapshot.data.roomBanner.message,'같이 달려요!');
 assert.equal(Date.parse(snapshot.data.roomBanner.startsAt),Date.parse('2026-11-01T06:00:00+09:00'));
 assert.ok(snapshot.serverNow && snapshot.data.profile && snapshot.data.day);
 assert.equal((await today(other)).data.roomBanner,null);
 assert.equal((await role('authenticated',other,'select * from public.room_banners')).rows.length,0);
 assert.equal((await role('authenticated',unadmitted,'select * from public.room_banners')).rows.length,0);
 await assert.rejects(()=>today(unadmitted),/Onboarding required/);
 // Anonymous reads/writes and all regular-user mutations/RPCs must fail.
 for(const name of ['anon','authenticated']) {
  for(const sql of [
   `insert into public.room_banners(room_id,message) values(1,'hack')`,
   `update public.room_banners set enabled=false where room_id=0`,
   `delete from public.room_banners where room_id=0`,
   publish,`select public.admin_hide_room_banner(0::smallint)`,
  ]) await assert.rejects(()=>role(name,user,sql),/permission denied/);
 }
 await assert.rejects(()=>role('anon',null,'select * from public.room_banners'),/permission denied/);
 await assert.rejects(()=>role('anon',null,'select public.get_today()'),/permission denied/);
 for (const args of [
  `0::smallint,'',now(),null`, `0::smallint,'   ',now(),null`,
  `0::smallint,repeat('a',41),now(),null`, `0::smallint,E'a\\nb',now(),null`,
  `0::smallint,'a',now(),now()`, `0::smallint,'a',now(),now()-interval '1 second'`,
  `0::smallint,'a','infinity',null`, `0::smallint,'a',now(),'infinity'`,
  `0::smallint,'a',null,null`, `2::smallint,'a',now(),null`,
 ]) await assert.rejects(()=>admin(`select public.admin_publish_room_banner(${args})`));
 await admin(`select public.admin_publish_room_banner(1::smallint,'다른 방')`);
 assert.equal((await today(other)).data.roomBanner.message,'다른 방');
 await admin(`select public.admin_publish_room_banner(0::smallint,'새 문구')`);
 assert.equal((await asUser('select * from public.room_banners')).rows.length,1);
 assert.equal((await today()).data.roomBanner.endsAt,null);
 await admin(`select public.admin_publish_room_banner(0::smallint,'과거','2020-01-01','2020-01-02')`);
 snapshot=await today();
 assert.equal(snapshot.data.roomBanner.message,'과거');
 assert.ok(Date.parse(snapshot.data.roomBanner.endsAt)<Date.parse(snapshot.serverNow));
 // Future/expired schedules remain available for local interval evaluation.
 await admin(`select public.admin_publish_room_banner(0::smallint,'미래','2099-01-01',null)`);
 assert.equal((await today()).data.roomBanner.message,'미래');
 saved=(await admin(`select public.admin_hide_room_banner(0::smallint) as b`)).rows[0].b;
 assert.equal(saved.enabled,false);
 assert.equal((await today()).data.roomBanner,null);
 assert.equal((await asUser('select * from public.room_banners')).rows.length,0);
 assert.equal((await admin('select * from public.room_banners where room_id=0')).rows[0].message,'미래');
 await assert.rejects(()=>admin(`select public.admin_hide_room_banner(null::smallint)`),/Invalid room/);
 // Triggers stamp even direct trusted SQL writes.
 await admin(`update public.room_banners set updated_at='2000-01-01' where room_id=0`);
 assert.ok(Date.parse((await admin('select updated_at from public.room_banners where room_id=0')).rows[0].updated_at)>Date.parse('2026-01-01'));
 assert.equal((await db.query(`select relrowsecurity from pg_class where oid='public.room_banners'::regclass`)).rows[0].relrowsecurity,true);
 const functions=(await db.query(`select prosecdef from pg_proc where proname in ('admin_publish_room_banner','admin_hide_room_banner','stamp_room_banner')`)).rows;
 assert.equal(functions.length,3); assert.ok(functions.every(f=>!f.prosecdef));
 console.log('PASS: snapshots, one-per-room upsert, future/expired/open-ended schedules, hide, timestamps, validation, anonymous/user/admin permissions and room/admission isolation.');
} finally { await db.close(); }
