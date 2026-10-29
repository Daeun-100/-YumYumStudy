import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestDatabase } from './test-database.mjs';
const db=await createTestDatabase(process.argv[2]);
try {
 const u='00000000-0000-4000-8000-000000000001',v='00000000-0000-4000-8000-000000000002';
 await db.exec(`insert into auth.users values('${u}'),('${v}');
 insert into public.profiles(id,room_id,display_name,character,invite_verified_at,name_confirmed) values('${u}',0,'new','bunny',now(),true),('${v}',0,'owned','bunny',now(),true);
 update public.character_skins set grant_enabled=true where id in ('bunny-toothache','bunny-bungeoppang');
 insert into vault.secrets values('log_monitor_cron_secret',repeat('a',64));`);
 const call=async(name,args=[])=> (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args)).rows[0].r;
 const request=(notification)=>({request_id:randomUUID(),event_id:'2026-push-test',name:'이벤트 선물',document_path:'docs/events/push-test.md',kind:'grant_skins',room_id:0,run_at:new Date(Math.ceil(Date.now()/60000)*60000+600000).toISOString(),skin_ids:['bunny-toothache'],...(notification===undefined?{}:{notification})});
 const due=async p=>{await call('admin_schedule_event',[JSON.stringify(p)]);await db.query("update private.event_jobs set run_at=now()-interval '1 minute' where id=$1",[p.request_id]);return call('admin_recover_event',[p.request_id,'grant']);};
 await db.exec(`insert into public.user_skins(user_id,skin_id) values('${v}','bunny-toothache')`);
 const p=request({title:'이벤트 선물',body:'새 스킨을 확인해 주세요.'});await due(p);
 let rows=(await db.query('select * from private.event_notifications')).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].user_id,u);assert.equal(rows[0].state,'queued');assert.equal(rows[0].title,p.notification.title);
 assert.equal((await db.query('select count(*)::int n from net.test_requests')).rows[0].n,1);
 await call('admin_recover_event',[p.request_id,'grant']);assert.equal((await db.query('select count(*)::int n from private.event_notifications')).rows[0].n,1);
 const owned=request();await due(owned);assert.equal((await db.query('select count(*)::int n from private.event_notifications')).rows[0].n,1);
 await db.exec(`insert into public.character_skins(id,name,character,grant_enabled) values('push-disabled','silent','bunny',true)`);
 await due({...request({enabled:false}),skin_ids:['push-disabled']});assert.equal((await db.query('select count(*)::int n from private.event_notifications')).rows[0].n,1);
 // Missing credentials and HTTP queue failures never roll back ownership.
 await db.exec("delete from vault.secrets;insert into public.character_skins(id,name,character,grant_enabled) values('push-missing','missing','bunny',true)");
 const missing={...request(),skin_ids:['push-missing']};await due(missing);
 rows=(await db.query('select * from private.event_notifications where job_id=$1',[missing.request_id])).rows;
 assert.equal(rows.length,2);assert(rows.every(r=>r.state==='configuration_required'));
 assert.equal((await db.query("select count(*)::int n from public.user_skins where skin_id='push-missing'")).rows[0].n,2);
 await db.exec(`insert into vault.secrets values('log_monitor_cron_secret',repeat('a',64));
 create or replace function net.http_post(url text,body jsonb default '{}'::jsonb,params jsonb default '{}'::jsonb,headers jsonb default '{}'::jsonb,timeout_milliseconds int default 2000) returns bigint language plpgsql as $$ begin raise exception 'network queue failure';end $$;
 insert into public.character_skins(id,name,character,grant_enabled) values('push-network','network','bunny',true);`);
 const network={...request(),skin_ids:['push-network']};await due(network);
 assert.equal((await db.query("select count(*)::int n from private.event_notifications where job_id=$1 and state='failed'",[network.request_id])).rows[0].n,2);
 assert.equal((await db.query("select count(*)::int n from public.user_skins where skin_id='push-network'")).rows[0].n,2);
 // Completed state is monotonic, and app roles can access neither queue nor helper RPCs.
 const nid=(await db.query('select id from private.event_notifications limit 1')).rows[0].id;
 await call('admin_finish_event_notification',[nid,'completed',null]);await call('admin_finish_event_notification',[nid,'unknown','Network']);
 assert.equal((await call('admin_event_notification_payload',[nid])).state,'completed');
 for(const n of [null,[],{enabled:'false'},{title:''},{body:'x'.repeat(161)},{title:'bad\ncopy'},{recipient:'other'}])await assert.rejects(()=>call('admin_schedule_event',[JSON.stringify(request(n))]));
 for(const role of ['anon','authenticated']) {
  await db.exec(`set role ${role}`);
  await assert.rejects(()=>db.query('select * from private.event_notifications'),/permission denied/);
  await assert.rejects(()=>call('admin_event_notification_payload',[nid]),/permission denied/);
  await assert.rejects(()=>call('admin_retry_event_notification',[nid]),/permission denied/);
  await db.exec('reset role');
 }
 console.log('Event notification DB checks passed: new grants only, deduplication, opt-out, copy validation, queue failure isolation and role restrictions.');
} finally {await db.close();}
