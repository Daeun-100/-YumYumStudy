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
  // External scheduler/Vault are unrelated to skin behavior. Keep the weekly
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
 async function asUser(sql) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`);
  try { return await db.query(sql); } finally { await db.exec('reset role;'); }
 }
 async function rejected(fn,match) { await assert.rejects(fn,match); }
 await rejected(()=>asUser(`select public.admin_grant_skin('${user}','bunny-toothache',0::smallint,true)`),/permission denied/);
 await rejected(()=>asUser(`insert into public.user_skins(user_id,skin_id) values('${user}','bunny-toothache')`),/permission denied/);
 await rejected(()=>asUser(`select public.apply_my_skin('bunny-toothache')`),/Skin not owned/);
 await rejected(()=>db.query(`select public.admin_grant_skin('${user}','bunny-toothache',0::smallint,true)`),/not available/);
 await db.exec(`update public.character_skins set grant_enabled=true where id='bunny-toothache';`);
 await rejected(()=>db.query(`select public.admin_grant_skin('${user}','bunny-toothache',1::smallint,true)`),/selected room/);
 await db.exec('set role service_role;');
 await db.query(`select public.admin_grant_skin('${user}','bunny-toothache',0::smallint,true)`);
 await db.exec('reset role;');
 let profile=(await asUser(`select public.ensure_profile(0::smallint) as p`)).rows[0].p;
 assert.equal(profile.character,'bunny'); assert.equal(profile.activeSkinId,'bunny-toothache');
 assert.equal((await asUser(`select public.get_today() as t`)).rows[0].t.data.profile.activeSkinId,'bunny-toothache');
 assert.equal((await asUser(`select public.get_room() as r`)).rows[0].r.data.find(x=>x.profile.id===user).profile.activeSkinId,'bunny-toothache');
 const first=(await db.query(`select granted_at from public.user_skins where user_id='${user}'`)).rows[0].granted_at;
 await db.query(`select public.admin_grant_skin('${user}','bunny-toothache',0::smallint,false)`);
 assert.equal((await db.query(`select count(*)::int as n from public.user_skins where user_id='${user}'`)).rows[0].n,1);
 assert.deepEqual((await db.query(`select granted_at from public.user_skins where user_id='${user}'`)).rows[0].granted_at,first);
 profile=(await asUser(`select public.set_profile('새이름','bunny') as p`)).rows[0].p;
 assert.equal(profile.activeSkinId,'bunny-toothache');
 profile=(await asUser(`select public.set_profile('새이름','bear') as p`)).rows[0].p;
 assert.equal(profile.activeSkinId,null); assert.equal(profile.character,'bear');
 profile=(await asUser(`select public.apply_my_skin('bunny-toothache') as p`)).rows[0].p;
 assert.equal(profile.character,'bunny'); assert.equal(profile.activeSkinId,'bunny-toothache');
 profile=(await asUser(`select public.apply_my_skin(null) as p`)).rows[0].p;
 assert.equal(profile.activeSkinId,null); assert.equal(profile.character,'bunny');
 assert.equal((await asUser(`select public.get_my_skins() as c`)).rows[0].c.skins.length,1);
 assert.equal((await asUser('select * from public.user_skins')).rows.length,1);
 assert.equal((await asUser('select * from public.character_skins')).rows.length,1);
 await db.exec(`update public.character_skins set grant_enabled=false where id='bunny-toothache'`);
 await asUser(`select public.apply_my_skin('bunny-toothache')`);
 await db.query(`select public.admin_apply_skin('${user}',null,0::smallint)`);
 await rejected(()=>db.query(`select public.admin_apply_skin('00000000-0000-4000-8000-000000000002','bunny-toothache',1::smallint)`),/Skin not owned/);
 await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);`);
 assert.equal((await db.query('select * from public.user_skins')).rows.length,0);
 assert.equal((await db.query('select * from public.character_skins')).rows.length,0);
 await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);`);
 await rejected(()=>db.query('select public.get_my_skins()'),/Onboarding required/);
 await db.exec(`reset role; set role anon;`);
 await rejected(()=>db.query('select public.get_my_skins()'),/permission denied/);
 await db.exec('reset role;');
 const protectedTables = await db.query(`select relname,relrowsecurity from pg_class where oid in ('public.character_skins'::regclass,'public.user_skins'::regclass)`);
 assert.ok(protectedTables.rows.every(row=>row.relrowsecurity));
 const functions=await db.query(`select n.nspname,p.proname,p.prosecdef,has_function_privilege('anon',p.oid,'execute') as anonymous from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('apply_my_skin','get_my_skins','admin_apply_skin','admin_grant_skin','apply_owner_skin','owner_skin_collection')`);
 assert.ok(functions.rows.every(row=>!row.anonymous));
 assert.ok(functions.rows.filter(row=>row.prosecdef).every(row=>row.nspname==='private'));
 console.log('PASS: grant/apply/reset, cross-character, duplicate grant, preserved ownership, profile editing, snapshot propagation, disabled grants, RLS, admin/anonymous/admission restrictions.');
} finally { await db.close(); }
