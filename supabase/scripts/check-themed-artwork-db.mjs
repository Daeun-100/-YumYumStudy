import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestDatabase } from './test-database.mjs';
const db=await createTestDatabase(process.argv[2]);
try {
 const u='00000000-0000-4000-8000-000000000001',v='00000000-0000-4000-8000-000000000002',w='00000000-0000-4000-8000-000000000003';
 await db.exec(`insert into auth.users values('${u}'),('${v}'),('${w}');insert into public.profiles(id,room_id,display_name,character,invite_verified_at,name_confirmed) values('${u}',0,'owner','bunny',now(),true),('${v}',0,'friend','bunny',now(),true),('${w}',1,'other','bunny',now(),true);`);
 const call=async(name,args=[])=> (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args)).rows[0].r;
 const manifest=(kind,id,theme='winter')=>({schemaVersion:2,theme,kind,id,name:'주제 에셋',...(kind==='skin'?{character:'bunny'}:{}),effects:[],...Object.fromEntries(['home','focus'].map(screen=>[screen,{path:`${theme}/${kind==='skin'?`skins/${id}`:'backgrounds'}/${screen}.png`,sha256:'a'.repeat(64),bytes:100,width:screen==='home'?1536:kind==='skin'?1254:1024,height:screen==='home'?1024:kind==='skin'?1254:1536}]))});
 const upload=async m=>{for(const screen of ['home','focus'])await db.query("insert into storage.objects(bucket_id,name,metadata) values('event-artwork',$1,$2)",[m[screen].path,JSON.stringify({mimetype:'image/png',size:100})]);};
 const skin=manifest('skin','winter-bunny');await assert.rejects(()=>call('admin_register_artwork',[JSON.stringify(skin),true]),/Upload/);await upload(skin);await call('admin_register_artwork',[JSON.stringify(skin),true]);
 assert.equal((await call('admin_artwork_library',['winter'])).length,1);assert.equal((await call('admin_artwork_library',['halloween'])).length,0);
 assert.equal((await db.query('select count(*)::int n from private.artwork_revisions')).rows[0].n,0);
 await db.exec(`insert into public.user_skins(user_id,skin_id) values('${u}','winter-bunny');update public.profiles set active_skin_id='winter-bunny' where id='${u}';`);
 const asUser=async id=>db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`);
 await asUser(u);assert.equal((await call('get_skin_artwork',[[skin.id],0]))[0].theme,'winter');await db.exec('reset role');
 await asUser(v);assert.equal((await call('get_skin_artwork',[[skin.id],0])).length,1);await assert.rejects(()=>call('get_skin_artwork',[[skin.id],1]),/Room identity/);await assert.rejects(()=>call('admin_artwork_library',[]),/permission denied/);await db.exec('reset role');
 await asUser(w);assert.equal((await call('get_skin_artwork',[[skin.id],1])).length,0);await db.exec('reset role');
 await assert.rejects(()=>call('admin_register_artwork',[JSON.stringify({...skin,character:'cat'}),false]),/character cannot change/);
 for(const changed of [{theme:'winter/..'},{revision:randomUUID()},{home:{...skin.home,path:'winter/backgrounds/home.png'}},{home:{...skin.home,path:'winter/skins/../home.png'}}])await assert.rejects(()=>call('admin_register_artwork',[JSON.stringify({...skin,...changed}),false]));
 const bg=manifest('background','halloween-room','halloween');await upload(bg);await call('admin_register_artwork',[JSON.stringify(bg),true]);
 const future=mins=>new Date(Math.ceil(Date.now()/60000)*60000+mins*60000).toISOString();
 const event={request_id:randomUUID(),event_id:'2026-themed-test',name:'행사',document_path:'docs/events/themed-test.md',kind:'set_backgrounds',room_id:0,run_at:future(10),ends_at:future(12),background_id:bg.id,screens:['home','focus']};
 const first=await call('admin_schedule_event',[JSON.stringify(event)]);assert.equal(first.artwork_revision,null);
 await call('admin_schedule_event',[JSON.stringify({...event,request_id:randomUUID(),run_at:future(20),ends_at:future(22)})]);
 assert.equal((await db.query('select count(*)::int n from private.artwork_library')).rows[0].n,2);
 await asUser(u);let window=(await call('get_event_backgrounds',[0])).windows[0];assert.equal(window.artwork.home.path,'halloween/backgrounds/home.png');await db.exec('reset role');
 // Updating a library asset changes its consumers; no per-event image revision is created.
 const updated={...bg,name:'업데이트',home:{...bg.home,path:'halloween/backgrounds/home-2.png'}};await upload(updated);await call('admin_register_artwork',[JSON.stringify(updated),false]);
 await asUser(u);window=(await call('get_event_backgrounds',[0])).windows[0];assert.equal(window.artwork.home.path,'halloween/backgrounds/home-2.png');await db.exec('reset role');
 await assert.rejects(()=>call('admin_schedule_event',[JSON.stringify({...event,request_id:randomUUID(),artwork_revision:randomUUID()})]),/Image revisions/);
 await asUser(u);await assert.rejects(()=>db.query('select * from private.artwork_library'),/permission denied/);await assert.rejects(()=>call('admin_register_artwork',[JSON.stringify(bg),false]),/permission denied/);await db.exec('reset role');
 assert.equal((await db.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('admin_stage_artwork','admin_publish_artwork','admin_artwork_report')")).rows[0].n,0);
 console.log('PASS: theme folder validation, direct registration, no revision rows, reusable assets, live path updates, single-format API, ownership and room isolation.');
} finally {await db.close();}
