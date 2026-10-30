import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestDatabase } from './test-database.mjs';
const db=await createTestDatabase(process.argv[2]);
try {
 const [u,v,other,unadmitted,late]=Array.from({length:5},()=>randomUUID());
 for(const [id,room,admitted] of [[u,0,true],[v,0,true],[other,1,true],[unadmitted,0,false],[late,0,false]]) {
  await db.query('insert into auth.users values($1)',[id]);
  await db.query(`insert into public.profiles(id,room_id,display_name,character,invite_verified_at,name_confirmed)
   values($1,$2,'recipient test','bunny',case when $3 then now() else null end,$3)`,[id,room,admitted]);
 }
 await db.exec(`insert into public.character_skins(id,name,character,grant_enabled) values
  ('recipient-a','A','bunny',true),('recipient-b','B','cat',true);`);
 const future=()=>new Date(Math.ceil(Date.now()/60000)*60000+600000).toISOString();
 const request=(overrides={})=>({request_id:randomUUID(),event_id:'recipient-test',name:'test',document_path:'docs/events/test.md',kind:'grant_skins',room_id:0,run_at:future(),skin_ids:['recipient-a'],...overrides});
 const call=async(name,args)=> (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;
 const schedule=p=>call('admin_schedule_event',[JSON.stringify(p)]);
 const counts=async()=> (await db.query('select (select count(*) from private.event_jobs)::int jobs,(select count(*) from cron.job)::int cron')).rows[0];
 const baseCounts=await counts();
 for(const user_ids of [null,[],{},u,[null],[1],['invalid'],[u,u],[u.toUpperCase(),u],[other],[unadmitted],[randomUUID()],Array(501).fill(u)]) {
  await assert.rejects(()=>schedule(request({user_ids})));
  assert.deepEqual(await counts(),baseCounts,'invalid request must not leave jobs or Cron');
 }
 await assert.rejects(()=>schedule(request({kind:'set_backgrounds',user_ids:[u],background_id:'halloween',screens:['home'],ends_at:future()})),/user_ids/);
 const aRequest=request({user_ids:[u],notification:{title:'할로윈 이벤트 시작!👻',body:'스킨이 지급되었어요 확인해보세요'}});
 const a=await schedule(aRequest),b=await schedule(request({user_ids:[v],skin_ids:['recipient-b']}));
 assert.deepEqual(a.recipients,[u]);assert.deepEqual(b.recipients,[v]);
 assert.equal((await schedule(aRequest)).id,a.id);
 await assert.rejects(()=>schedule({...aRequest,user_ids:[v]}),/reused/);
 await assert.rejects(()=>schedule(request({replaces:a.id,user_ids:[v]})),/preserve/);
 assert.equal((await db.query('select state from private.event_jobs where id=$1',[a.id])).rows[0].state,'scheduled');
 // Changing the time preserves the original selection even when user_ids is omitted.
 const changed=await schedule(request({replaces:a.id,notification:aRequest.notification}));
 assert.deepEqual(changed.recipients,[u]);
 await db.query('update public.profiles set invite_verified_at=now(),name_confirmed=true where id=$1',[late]);
 const all=await schedule(request());assert.deepEqual([...all.recipients].sort(),[u,v,late].sort());
 await assert.rejects(()=>schedule(request({replaces:all.id,user_ids:[u]})),/preserve/);
 await call('admin_cancel_event',[all.id]);
 // Run selected jobs: no cross-grants, no grants or notifications for unselected members.
 for(const job of [changed,b]) {
  await db.query("update private.event_jobs set run_at=now()-interval '1 minute' where id=$1",[job.id]);
  assert.equal((await call('admin_recover_event',[job.id,'grant'])).state,'completed');
  await call('admin_recover_event',[job.id,'grant']);
 }
 const owned=(await db.query('select user_id,skin_id from public.user_skins order by skin_id')).rows;
 assert.deepEqual(owned,[{user_id:u,skin_id:'recipient-a'},{user_id:v,skin_id:'recipient-b'}]);
 const notices=(await db.query('select user_id,title,body from private.event_notifications order by title')).rows;
 assert.equal(notices.length,2);assert.deepEqual(notices.map(n=>n.user_id).sort(),[u,v].sort());
 assert.deepEqual(notices.find(n=>n.user_id===u),{user_id:u,...aRequest.notification});
 assert.equal((await db.query('select count(*)::int n from public.profiles where active_skin_id is not null')).rows[0].n,0);
 // Loss of admission after scheduling excludes the user at execution, with no notification.
 const excluded=await schedule(request({user_ids:[late],skin_ids:['recipient-b']}));
 await db.query('update public.profiles set name_confirmed=false where id=$1',[late]);
 await db.query("update private.event_jobs set run_at=now()-interval '1 minute' where id=$1",[excluded.id]);
 await call('admin_recover_event',[excluded.id,'grant']);
 assert.equal((await db.query('select count(*)::int n from public.user_skins where user_id=$1',[late])).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from private.event_notifications where job_id=$1',[excluded.id])).rows[0].n,0);
 assert.equal((await db.query('select d.result from private.event_deliveries d join private.event_runs r on r.id=d.run_id where r.job_id=$1',[excluded.id])).rows[0].result,'excluded');
 for(const role of ['anon','authenticated']) {
  await db.exec(`set role ${role}`);
  await assert.rejects(()=>schedule(request({user_ids:[u]})),/permission denied/);
  await assert.rejects(()=>db.query('select private.schedule_event_local($1::jsonb)',[JSON.stringify(request({user_ids:[u]}))]),/permission denied/);
  await db.exec('reset role');
 }
 await db.exec('set role service_role');
 const serviceJob=await schedule(request({user_ids:[u]}));assert.deepEqual(serviceJob.recipients,[u]);
 await assert.rejects(()=>db.query('select private.schedule_event_local($1::jsonb)',[JSON.stringify(request({user_ids:[u]}))]),/permission denied/);
 await db.exec('reset role');
 console.log('PASS: selected recipients, room/admission validation, immutable replacements, idempotency, distinct grants and push copy, exclusions and RPC permissions. Cron/HTTP use isolated substitutes.');
} finally {await db.close();}
