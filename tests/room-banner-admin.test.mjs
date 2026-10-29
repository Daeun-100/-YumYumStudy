import test from 'node:test';
import assert from 'node:assert/strict';
import { manageBanner, publishInput } from '../supabase/scripts/manage-banners.mjs';

test('publish validates timezone, period, Unicode length, controls and explicit room', () => {
 const data = publishInput(1,{message:'  같이 달려요!  ',startsAt:'2026-11-01T06:00:00+09:00',endsAt:'2026-11-08T06:00:00+09:00'});
 assert.equal(data.p_message,'같이 달려요!');
 assert.equal(data.p_starts_at,'2026-10-31T21:00:00.000Z');
 assert.equal(publishInput(0,{message:'🐱'.repeat(40)}).p_message.length,80);
 for (const input of [
  {message:''},{message:'a'.repeat(41)},{message:'a\nb'},
  {message:'a',startsAt:'2026-11-01T06:00:00'},
  {message:'a',startsAt:'2026-02-30T06:00:00+09:00'},
  {message:'a',startsAt:'2026-11-01T06:00:00Z',endsAt:'2026-11-01T06:00:00Z'},
  {message:'a',startsAt:null},{message:'a',screen:'home'},
 ]) assert.throws(() => publishInput(1,input));
 assert.throws(() => publishInput(null,{message:'a'}));
});

test('admin publishes then reads the same explicit room to confirm persistence', async () => {
 const saved={room_id:1,message:'hello',enabled:true,starts_at:'2026-11-01T00:00:00Z',ends_at:null,updated_at:'2026-10-29T00:00:00Z'};
 const calls=[];
 const result=await manageBanner('publish',1,{message:'hello'}, {url:'https://example.supabase.co',key:'test-secret',fetcher:async(url,options)=>{
  calls.push({url,options});
  return {ok:true,json:async()=>calls.length===1 ? saved : [saved]};
 }});
 assert.deepEqual(result,saved);
 assert.equal(calls.length,2);
 assert.match(calls[0].url.pathname,/rpc\/admin_publish_room_banner$/);
 assert.equal(JSON.parse(calls[0].options.body).p_room_id,1);
 assert.equal(calls[1].url.searchParams.get('room_id'),'eq.1');
 assert.equal(calls[0].options.redirect,'error');
});

test('hide of missing banner is safe; failed writes never auto-retry', async () => {
 let count=0;
 assert.equal(await manageBanner('hide',0,null,{url:'https://example.supabase.co',key:'test',fetcher:async()=>({ok:true,json:async()=>++count===1?null:[]})}),null);
 count=0;
 await assert.rejects(()=>manageBanner('hide',1,null,{url:'https://example.supabase.co',key:'test',fetcher:async()=>{count++;return {ok:false,status:403};}}),/403/);
 assert.equal(count,1);
});

test('readback mismatch and insecure transport fail explicitly', async () => {
 let count=0;
 await assert.rejects(()=>manageBanner('hide',1,null,{url:'https://example.supabase.co',key:'test',fetcher:async()=>({ok:true,json:async()=>++count===1?{room_id:1,enabled:false}:[{room_id:1,enabled:true}]})}),/Readback differs/);
 await assert.rejects(()=>manageBanner('show',1,null,{url:'http://example.com',key:'test'}),/HTTPS/);
});
