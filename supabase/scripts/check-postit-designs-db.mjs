import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createTestDatabase} from './test-database.mjs';
const db=await createTestDatabase(process.argv[2]);
const call=async(name,args=[])=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;
const u=randomUUID(),v=randomUUID(),outside=randomUUID();
const manifest=(id='halloween-paper',revision=randomUUID())=>({schemaVersion:1,kind:'postit',id,revision,name:'할로윈 포스트잇',fallbackColor:'#F9E8A0',textColor:'#453F30',paper:{path:`postit/${id}/${revision}/paper.png`,width:1024,height:1024,bytes:100,sha256:'a'.repeat(64)}});
const upload=async m=>{await db.query("insert into storage.objects(bucket_id,name,metadata) values('event-artwork',$1,$2)",[m.paper.path,JSON.stringify({size:100,mimetype:'image/png'})]);await call('admin_stage_artwork',[JSON.stringify(m)]);};
const asUser=async uid=>{await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${uid}',false);`);};
const rule=async(m,changes={})=>{
 const bounds=(await db.query("select ((public.study_date(now())+time '06:00') at time zone 'Asia/Seoul') lo, ((public.study_date(now())+1+time '06:00') at time zone 'Asia/Seoul') hi")).rows[0];
 const request={request_id:randomUUID(),event_id:'qa-postit',name:'QA',document_path:'docs/events/qa-postit.md',room_id:0,design_id:m.id,
 starts_at:bounds.lo,ends_at:bounds.hi,required_seconds:1860,...changes};
 return {request,result:await call('admin_configure_postit_reward',[JSON.stringify(request)])};
};
try{
 await db.query('insert into auth.users values($1),($2),($3)',[u,v,outside]);
 await db.query("insert into public.profiles(id,room_id,display_name,character,invite_verified_at,name_confirmed) values($1,0,'author','bunny',now(),true),($2,0,'friend','bunny',now(),true),($3,1,'other','bunny',now(),true)",[u,v,outside]);
 const m=manifest();
 await assert.rejects(()=>call('admin_stage_artwork',[JSON.stringify(m)]),/Upload verified/);
 await upload(m);await call('admin_publish_artwork',[m.revision,true]);
 await assert.rejects(()=>call('admin_stage_artwork',[JSON.stringify({...m,paper:{...m.paper,width:512}})]),/Invalid postit PNG/);
 await assert.rejects(()=>call('admin_stage_artwork',[JSON.stringify({...m,name:'overwrite'})]),/immutable/);
 const {request,result}=await rule(m);
 assert.equal((await call('admin_configure_postit_reward',[JSON.stringify(request)])).id,result.id);
 await assert.rejects(()=>call('admin_configure_postit_reward',[JSON.stringify({...request,required_seconds:1})]),/reused/);
 await assert.rejects(()=>rule(m,{ends_at:new Date(Date.now()+172800000).toISOString()}),/check constraint/);
 // Closed + running fragments total exactly the threshold at transaction time.
 await db.query("insert into public.study_sessions(user_id,room_id,started_at,ended_at) values($1,0,now()-interval '40 minutes',now()-interval '25 minutes')",[u]);
 await db.query("insert into public.study_sessions(user_id,room_id,started_at) values($1,0,now()-interval '959 seconds')",[u]);
 await asUser(u);
 assert.equal((await call('sync_postit_designs',[0])).owned.length,0);
 await assert.rejects(()=>call('admin_configure_postit_reward',[JSON.stringify(request)]),/permission denied/);
 await assert.rejects(()=>call('sync_postit_designs',[1]),/Room identity/);
 await assert.rejects(()=>call('put_designed_postit',[randomUUID(),'hello','#F9E8A0',.5,.5,m.id]),/보유한/);
 await db.exec('reset role');await db.query("update public.study_sessions set started_at=now()-interval '960 seconds' where user_id=$1 and ended_at is null",[u]);
 await asUser(u);
 const first=await call('sync_postit_designs',[0]);assert.equal(first.owned.length,1);
 const grant=first.owned[0];assert.equal((await call('sync_postit_designs',[0])).owned[0].grantId,grant.grantId);
 const noteId=randomUUID();const note=await call('put_designed_postit',[noteId,'원격 디자인','#F7CED4',.5,.5,m.id]);
 assert.equal(note.color,'#F9E8A0');assert.equal(note.design_revision,m.revision);
 assert.equal((await call('put_designed_postit',[noteId,'retry','#F9E8A0',.1,.1,m.id])).text,'원격 디자인');
 await asUser(v);
 const friend=await call('sync_postit_designs',[0]);assert.equal(friend.owned.length,0);assert.equal(friend.visible[0].revision,m.revision);
 await assert.rejects(()=>call('put_designed_postit',[randomUUID(),'copy','#F9E8A0',.5,.5,m.id]),/보유한/);
 assert.equal((await call('get_room_postits')).notes[0].color,'#F9E8A0');
 await assert.rejects(()=>call('admin_artwork_report'),/permission denied/);
 await assert.rejects(()=>db.query('select * from private.user_postit_designs'),/permission denied/);
 await asUser(outside);assert.equal((await call('sync_postit_designs',[1])).visible.length,0);
 await assert.rejects(()=>call('delete_room_postit',[noteId]),/더 이상/);
 await db.exec('reset role');
 const newer=manifest(m.id);await upload(newer);await call('admin_publish_artwork',[newer.revision,false]);
 await asUser(u);const refreshed=await call('sync_postit_designs',[0]);assert.equal(refreshed.owned[0].artwork.revision,newer.revision);assert.equal(refreshed.visible[0].revision,m.revision);
 assert.equal((await call('put_designed_postit',[randomUUID(),'new','#F9E8A0',.5,.5,m.id])).design_revision,newer.revision);
 // Legacy path, 50-character limit and deletion remain active.
 assert.equal((await call('put_room_postit',[randomUUID(),'basic','#DAE8BE',.2,.3])).design_id,null);
 await assert.rejects(()=>call('put_designed_postit',[randomUUID(),'가'.repeat(51),'#F9E8A0',.5,.5,m.id]),/check constraint/);
 await call('delete_room_postit',[noteId]);
 await db.exec('reset role');
 // Ended events still grant for records in their window, excluding later time.
 const ended=manifest('ended-paper');await upload(ended);await call('admin_publish_artwork',[ended.revision,true]);
 const endedRule=await rule(ended,{starts_at:new Date(Date.now()-3600000).toISOString(),ends_at:new Date(Date.now()-1800000).toISOString(),required_seconds:1200});
 await asUser(u);assert.equal((await call('sync_postit_designs',[0])).owned.length,1); // only 10 minutes overlap
 await db.exec('reset role');await db.query("insert into public.study_sessions(user_id,room_id,started_at,ended_at) values($1,0,now()-interval '60 minutes',now()-interval '40 minutes')",[v]);
 await asUser(v);assert.equal((await call('sync_postit_designs',[0])).owned.length,1);
 await db.exec('reset role');
 const report=await call('admin_postit_reward_report',[endedRule.result.id,false]);assert.equal(report.deliveries.length,1);
 await call('admin_postit_reward_report',[endedRule.result.id,true]);await call('admin_postit_reward_report',[endedRule.result.id,true]);
 await call('admin_set_postit_design_enabled',[m.id,false]);
 await assert.rejects(()=>rule(m),/enabled postit/);
 await asUser(u);assert.equal((await call('sync_postit_designs',[0])).owned.length,1);
 assert.equal((await call('put_designed_postit',[randomUUID(),'still owned','#F9E8A0',.3,.3,m.id])).design_id,m.id);
 await db.exec('reset role');
 const permissions=(await db.query("select p.proname,has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') app from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.proname like '%postit%'")).rows;
 assert.ok(permissions.every(p=>!p.anon));assert.ok(permissions.filter(p=>p.proname.startsWith('admin_')).every(p=>!p.app));
 console.log('PASS: immutable PNG publish, enabled rules, 1859/1860-second split sessions, running time, duplicate grants, retry preservation, room/ownership rights, legacy colors, pinned revisions, ended-event recovery, cancellation and function permissions. Storage is an isolated substitute.');
}finally{await db.close();}
