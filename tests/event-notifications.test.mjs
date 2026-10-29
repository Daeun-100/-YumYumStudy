import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../supabase/functions/event-notifications/core.ts';
import { validateRequest } from '../supabase/scripts/manage-events.mjs';
const id='00000000-0000-4000-8000-000000000001';
const secret='s'.repeat(64),adminToken='a'.repeat(64);
function setup(overrides={}) {
 const sent=[],finished=[];
 const payload={action:'send',id,roomId:0,title:'선물',body:'스킨을 받았어요',userIds:['user'],state:'queued'};
 const handler=createHandler({secret,adminToken,load:async()=>payload,send:async p=>{sent.push(p);return {ok:true,status:200,statusText:'completed'};},finish:async(...args)=>{finished.push(args);},...overrides});
 const request=(body={id},token=secret)=>handler(new Request('https://example.test',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(body)}));
 return {request,sent,finished,payload};
}
test('only the trusted cron credential can dispatch and requests cannot override recipients or copy',async()=>{
 const h=setup();assert.equal((await h.request({id},'bad')).status,401);
 assert.equal((await h.request({id,userIds:['another']})).status,400);
 assert.equal((await h.request({id,title:'replace'})).status,400);
 assert.equal(h.sent.length,0);
});
test('dry run and completed announcements never send',async()=>{
 const h=setup();assert.equal((await h.request({id,dryRun:true})).status,200);assert.equal(h.sent.length,0);assert.equal(h.finished.length,0);
 h.payload.state='completed';await h.request();assert.equal(h.sent.length,0);
});
test('dispatch uses the immutable stored announcement id and server-selected message',async()=>{
 const h=setup();await h.request();assert.equal(h.sent.length,1);
 assert.deepEqual(h.sent[0],{action:'send',id,roomId:0,title:'선물',body:'스킨을 받았어요',userIds:['user']});
 assert.deepEqual(h.finished,[[id,'completed',undefined]]);
});
test('network uncertainty never starts another send',async()=>{
 let sends=0;const h=setup({send:async()=>{sends++;throw Error('timeout');}});
 assert.equal((await h.request()).status,502);assert.equal(sends,1);assert.deepEqual(h.finished,[[id,'unknown','Network']]);
});
test('missing dispatcher configuration records a recoverable configuration state',async()=>{
 const h=setup({adminToken:undefined});assert.equal((await h.request()).status,503);assert.equal(h.sent.length,0);assert.equal(h.finished[0][1],'configuration_required');
});
test('announcement rejection and unfinished dispatch are not recorded as delivery success',async()=>{
 const h=setup({send:async()=>({ok:false,status:400})});await h.request();assert.equal(h.finished[0][1],'failed');
 const pending=setup({send:async()=>({ok:true,status:200,statusText:'sending'})});await pending.request();assert.equal(pending.finished[0][1],'unknown');
});
const base={request_id:id,event_id:'test',name:'test',document_path:'docs/events/test.md',room_id:0,kind:'grant_skins',skin_ids:['bunny'],run_at:'2026-12-01T00:00:00Z'};
test('event copy is optional, supports opt-out, and rejects malformed or oversized copy',()=>{
 assert.equal(validateRequest(base),base);validateRequest({...base,notification:{enabled:false}});
 validateRequest({...base,notification:{title:'선물',body:'프로필에서 확인해 주세요.'}});
 for(const n of [null,[],{enabled:'false'},{title:''},{body:'x'.repeat(161)},{title:'bad\ncopy'},{recipient:'other'}])assert.throws(()=>validateRequest({...base,notification:n}));
});

test('authenticated dry runs verify configuration without creating an announcement',async()=>{
 const h=setup({load:async()=>null});const response=await h.request({id,dryRun:true});
 assert.equal(response.status,200);assert.equal((await response.json()).configured,true);assert.equal(h.sent.length,0);assert.equal(h.finished.length,0);
 const missing=setup({load:async()=>null,adminToken:undefined});assert.equal((await (await missing.request({id,dryRun:true})).json()).configured,false);
});
