import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeEventBackgrounds,selectEventBackgrounds} from '../src/lib/event-backgrounds.ts';
import {validateRequest,summarizeReport} from '../supabase/scripts/manage-events.mjs';
const start='2026-10-31T00:00:00Z',end='2026-10-31T21:00:00Z';
const window={id:'test',startsAt:start,endsAt:end,screens:['home','focus'],homeAsset:'halloween-home',focusAsset:'halloween-focus'};
test('event backgrounds use inclusive start and exclusive end even offline',()=>{
 assert.equal(selectEventBackgrounds([window],Date.parse(start)-1).home,undefined);
 assert.equal(selectEventBackgrounds([window],Date.parse(start)).home,'halloween-home');
 assert.equal(selectEventBackgrounds([window],Date.parse(end)-1).focus,'halloween-focus');
 assert.equal(selectEventBackgrounds([window],Date.parse(end)).focus,undefined);
 assert.equal(selectEventBackgrounds([window],Date.parse(end)).nextAt,null);
});
test('independent screen windows and next boundary',()=>{
 const windows=[{...window,screens:['home']},{...window,id:'focus',startsAt:'2026-10-31T01:00:00Z',screens:['focus']}];
 const selection=selectEventBackgrounds(windows,Date.parse(start));
 assert.equal(selection.home,'halloween-home');assert.equal(selection.focus,undefined);
 assert.equal(selection.nextAt,Date.parse('2026-10-31T01:00:00Z'));
});
test('malformed server payload cannot create an unbounded background',()=>{
 assert.throws(()=>decodeEventBackgrounds({serverNow:start,roomId:0,windows:[{...window,endsAt:null}]}));
 assert.throws(()=>decodeEventBackgrounds({serverNow:start,roomId:0,windows:[{...window,screens:['other']}]}));
 assert.deepEqual(decodeEventBackgrounds({serverNow:start,roomId:0,windows:[window]}).windows,[window]);
});
test('operator requests need timezone, room, supported operation and background end',()=>{
 const request={request_id:'00000000-0000-4000-8000-000000000001',event_id:'2026-test',name:'test',document_path:'docs/events/test.md',room_id:0,kind:'set_backgrounds',background_id:'halloween',screens:['home'],run_at:start,ends_at:end};
 assert.equal(validateRequest(request),request);
 for(const changed of [{run_at:'2026-10-31T09:00:00'},{room_id:null},{ends_at:null},{kind:'collect_candy'}]) assert.throws(()=>validateRequest({...request,...changed}));
});
test('default report omits private user IDs',()=>{
 const report=summarizeReport({events:[],backgrounds:[],jobs:[{id:'j',recipients:['private-user'],runs:[{deliveries:[{user_id:'private-user',result:'granted'}]}]}]});
 assert.ok(!JSON.stringify(report).includes('private-user'));
 assert.equal(report.jobs[0].runs[0].counts.granted,1);
});
