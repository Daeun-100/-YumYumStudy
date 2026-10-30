import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateRequest,summarizeReport} from '../supabase/scripts/manage-events.mjs';
const u=randomUUID(),v=randomUUID();
const base={request_id:randomUUID(),event_id:'test',name:'test',document_path:'docs/events/test.md',kind:'grant_skins',room_id:1,run_at:'2026-10-31T06:00:00+09:00',skin_ids:['bunny-halloween']};
test('optional recipient UUIDs support individual and room-wide skin grants',()=>{
 for(const request of [base,{...base,user_ids:[u]},{...base,user_ids:[u,v]}]) assert.equal(validateRequest(request),request);
});
test('invalid recipient selection never falls back to a room-wide grant',()=>{
 for(const user_ids of [null,[],{},u,[null],[1],['bad'],[u,u],[u.toUpperCase(),u],Array(501).fill(u)]) assert.throws(()=>validateRequest({...base,user_ids}));
 assert.throws(()=>validateRequest({...base,kind:'set_backgrounds',user_ids:[u],background_id:'halloween',screens:['home'],ends_at:'2026-11-01T06:00:00+09:00'}));
});
test('default reports hide selected identities and request payloads',()=>{
 const summary=summarizeReport({events:[],backgrounds:[],jobs:[{recipients:[u],request:{user_ids:[u]},runs:[]}]});
 assert.equal(summary.jobs[0].recipients,1);assert.equal(JSON.stringify(summary).includes(u),false);
});
