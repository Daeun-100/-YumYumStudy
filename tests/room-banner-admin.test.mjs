import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { manageBanner, publishInput, validatePng } from '../supabase/scripts/manage-banners.mjs';
const input={homeFile:'/private/tmp/home.png',focusFile:'/private/tmp/focus.png',description:'함께 달려요!',startsAt:'2026-11-01T06:00:00+09:00',endsAt:'2026-11-08T06:00:00+09:00'};
function png(width,height=300) {
 function chunk(type,data) {
  const block=Buffer.concat([Buffer.from(type),data]);
  let crc=0xffffffff;
  for(const byte of block) { crc^=byte; for(let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
  const header=Buffer.alloc(4),tail=Buffer.alloc(4); header.writeUInt32BE(data.length); tail.writeUInt32BE((crc^0xffffffff)>>>0);
  return Buffer.concat([header,block,tail]);
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.alloc((width*4+1)*height))),chunk('IEND',Buffer.alloc(0))]);
}
const home=png(1200),focus=png(1000);
const settings={url:'https://example.supabase.co',key:'test-secret',readImage:async path=>path===input.homeFile?home:focus};
test('two distinct images, accessible description and timezone-safe shared schedule are required',()=>{
 assert.equal(publishInput(1,input).p_starts_at,'2026-10-31T21:00:00.000Z');
 for(const value of [
  {...input,focusFile:undefined},{...input,focusFile:input.homeFile},{...input,homeFile:'relative.png'},
  {...input,description:' '},{...input,description:'a\nb'},{...input,description:'a'.repeat(161)},
  {...input,startsAt:null},{...input,startsAt:'2026-11-01T06:00:00'},
  {...input,startsAt:'2026-02-30T06:00:00Z'}, {...input,endsAt:input.startsAt},
  {...input,message:'removed field'},
 ]) assert.throws(()=>publishInput(1,value));
 assert.throws(()=>publishInput(null,input));
});
test('PNG dimensions, size, signature and complete chunks are checked',()=>{
 validatePng(home,'home');validatePng(focus,'focus');
 for(const value of [focus,home.subarray(0,33),Buffer.from('fake'),Buffer.alloc(2097153),png(1200,299)]) assert.throws(()=>validatePng(value,'home'));
});
test('uploads immutable pair before publishing once, then verifies stored paths',async()=>{
 const calls=[];let saved;
 const result=await manageBanner('publish',1,input,{...settings,fetcher:async(url,options)=>{
  calls.push({url,options});
  if(calls.length<=2) return {ok:true,json:async()=>({})};
  if(calls.length===3) {const args=JSON.parse(options.body);saved={room_id:1,home_image_path:args.p_home_image_path,focus_image_path:args.p_focus_image_path,alt_text:args.p_alt_text,enabled:true};}
  return {ok:true,json:async()=>calls.length===3?saved:[saved]};
 }});
 assert.deepEqual(result,saved);assert.equal(calls.length,4);
 assert.match(calls[0].url.pathname,/storage\/v1\/object\/room-banners\/rooms\/1\/.+\/home.png$/);
 assert.match(calls[1].url.pathname,/focus.png$/);
 assert.equal(calls[0].options.headers['x-upsert'],'false');
 assert.equal(calls[0].options.redirect,'error');
 assert.match(calls[2].url.pathname,/rpc\/admin_publish_room_banner$/);
 assert.equal(calls[3].url.searchParams.get('room_id'),'eq.1');
});
test('bad focus file causes zero uploads; second upload failure never publishes or retries',async()=>{
 let count=0;
 await assert.rejects(()=>manageBanner('publish',1,input,{...settings,readImage:async()=>home,fetcher:async()=>{count++;}}),/focus PNG/);
 assert.equal(count,0);
 await assert.rejects(()=>manageBanner('publish',1,input,{...settings,fetcher:async()=>({ok:++count===1,status:500,json:async()=>({})})}),/500/);
 assert.equal(count,2);
});
test('hide missing banner succeeds; readback mismatch and HTTP are rejected',async()=>{
 let count=0;
 assert.equal(await manageBanner('hide',0,null,{...settings,fetcher:async()=>({ok:true,json:async()=>++count===1?null:[]})}),null);
 count=0;
 await assert.rejects(()=>manageBanner('hide',1,null,{...settings,fetcher:async()=>({ok:true,json:async()=>++count===1?{room_id:1,enabled:false}:[{room_id:1,enabled:true}]})}),/Readback differs/);
 await assert.rejects(()=>manageBanner('show',1,null,{...settings,url:'http://example.com'}),/HTTPS/);
});
