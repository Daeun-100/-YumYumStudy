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
 create schema auth; create schema extensions; create schema realtime; create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text references storage.buckets(id),name text,primary key(bucket_id,name));
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated,service_role;
 grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
 -- Simulate an unrelated broad permissive policy: the bucket restriction must win.
 create policy old_permissive_policy on storage.objects for all to anon,authenticated using(true) with check(true);
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
 const folder='00000000-0000-4000-8000-000000000010';
 const home=`rooms/0/${folder}/home.png`,focus=`rooms/0/${folder}/focus.png`;
 const home1=`rooms/1/${folder}/home.png`,focus1=`rooms/1/${folder}/focus.png`;
 async function role(name,uid,sql) {
  await db.exec(`set role ${name}; select set_config('request.jwt.claim.sub','${uid ?? ''}',false);`);
  try { return await db.query(sql); } finally { await db.exec('reset role;'); }
 }
 const admin=sql=>role('service_role',null,sql);
 const asUser=sql=>role('authenticated',user,sql);
 const today=async(uid=user)=>(await role('authenticated',uid,'select public.get_today() as t')).rows[0].t;
 const publish=(room=0,alt='같이 달려요!',start="'2026-11-01T06:00:00+09:00'",end="'2026-11-08T06:00:00+09:00'",h=room===0?home:home1,f=room===0?focus:focus1)=>`select public.admin_publish_room_banner(${room}::smallint,'${h}','${f}','${alt}',${start},${end}) as b`;
 assert.equal((await today()).data.roomBanner,null);
 assert.equal((await admin('select public.admin_hide_room_banner(0::smallint) as b')).rows[0].b,null);
 await assert.rejects(()=>admin(publish()),/Both banner images/);
 await admin(`insert into storage.objects(bucket_id,name) values('room-banners','${home}')`);
 await assert.rejects(()=>admin(publish()),/Both banner images/);
 await admin(`insert into storage.objects(bucket_id,name) values('room-banners','${focus}'),('room-banners','${home1}'),('room-banners','${focus1}')`);
 let saved=(await admin(publish(0,'  같이 달려요!  '))).rows[0].b;
 assert.equal(saved.alt_text,'같이 달려요!');assert.equal(saved.enabled,true);
 let snapshot=await today();
 assert.equal(snapshot.data.roomBanner.homeImagePath,home);
 assert.equal(snapshot.data.roomBanner.focusImagePath,focus);
 assert.equal(snapshot.data.roomBanner.altText,'같이 달려요!');
 assert.equal(Date.parse(snapshot.data.roomBanner.startsAt),Date.parse('2026-11-01T06:00:00+09:00'));
 assert.ok(snapshot.serverNow && snapshot.data.profile && snapshot.data.day);
 assert.equal((await today(other)).data.roomBanner,null);
 assert.equal((await role('authenticated',other,'select * from public.room_banners')).rows.length,0);
 assert.equal((await role('authenticated',unadmitted,'select * from public.room_banners')).rows.length,0);
 await assert.rejects(()=>today(unadmitted),/Onboarding required/);
 for(const name of ['anon','authenticated']) {
  for(const sql of [
   `insert into public.room_banners(room_id,home_image_path,focus_image_path,alt_text) values(1,'${home1}','${focus1}','hack')`,
   'update public.room_banners set enabled=false where room_id=0',
   'delete from public.room_banners where room_id=0',publish(),'select public.admin_hide_room_banner(0::smallint)',
  ]) await assert.rejects(()=>role(name,user,sql),/permission denied/);
  await assert.rejects(()=>role(name,user,`insert into storage.objects(bucket_id,name) values('room-banners','hack.png')`),/row-level security/);
  assert.equal((await role(name,user,`select * from storage.objects where bucket_id='room-banners'`)).rows.length,0);
  assert.equal((await role(name,user,`update storage.objects set name='hack' where bucket_id='room-banners' returning *`)).rows.length,0);
  assert.equal((await role(name,user,`delete from storage.objects where bucket_id='room-banners' returning *`)).rows.length,0);
 }
 await assert.rejects(()=>role('anon',null,'select * from public.room_banners'),/permission denied/);
 await assert.rejects(()=>role('anon',null,'select public.get_today()'),/permission denied/);
 for(const sql of [publish(0,''),publish(0,'a'.repeat(161)),publish(0,'a','now()','now()'),
  publish(0,'a',"'infinity'",'null'),publish(0,'a','now()',"'infinity'"),publish(0,'a','null','null'),
  publish(0,'a','now()','null',home1,focus1),publish(0,'a','now()','null',home,home),
 ]) await assert.rejects(()=>admin(sql));
 // Failed validation cannot replace the currently published pair.
 assert.equal((await today()).data.roomBanner.homeImagePath,home);
 await admin(publish(1,'다른 방','now()','null'));
 assert.equal((await today(other)).data.roomBanner.altText,'다른 방');
 await admin(publish(0,'새 세트','now()','null'));
 assert.equal((await asUser('select * from public.room_banners')).rows.length,1);
 assert.equal((await today()).data.roomBanner.endsAt,null);
 await admin(publish(0,'과거',"'2020-01-01'","'2020-01-02'"));
 snapshot=await today();assert.ok(Date.parse(snapshot.data.roomBanner.endsAt)<Date.parse(snapshot.serverNow));
 await admin(publish(0,'미래',"'2099-01-01'",'null'));
 assert.equal((await today()).data.roomBanner.altText,'미래');
 saved=(await admin('select public.admin_hide_room_banner(0::smallint) as b')).rows[0].b;
 assert.equal(saved.enabled,false);assert.equal((await today()).data.roomBanner,null);
 assert.equal((await asUser('select * from public.room_banners')).rows.length,0);
 assert.equal((await admin('select * from public.room_banners where room_id=0')).rows[0].home_image_path,home);
 await assert.rejects(()=>admin('select public.admin_hide_room_banner(null::smallint)'),/Invalid room/);
 await admin(`update public.room_banners set updated_at='2000-01-01' where room_id=0`);
 assert.ok(Date.parse((await admin('select updated_at from public.room_banners where room_id=0')).rows[0].updated_at)>Date.parse('2026-01-01'));
 assert.equal((await db.query(`select relrowsecurity from pg_class where oid='public.room_banners'::regclass`)).rows[0].relrowsecurity,true);
 const functions=(await db.query(`select prosecdef from pg_proc where proname in ('admin_publish_room_banner','admin_hide_room_banner','stamp_room_banner')`)).rows;
 assert.equal(functions.length,3);assert.ok(functions.every(f=>!f.prosecdef));
 const bucket=(await db.query("select * from storage.buckets where id='room-banners'")).rows[0];
 assert.equal(bucket.public,true);assert.equal(Number(bucket.file_size_limit),2097152);assert.deepEqual(bucket.allowed_mime_types,['image/png']);
 console.log('PASS: atomic image pair publication, missing/wrong-room images, bucket restrictions, snapshots, schedules, hide, timestamps, anonymous/user/admin permissions and admission isolation.');
} finally { await db.close(); }
