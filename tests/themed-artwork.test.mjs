import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeArtwork, artworkUrl, artworkReference } from '../src/lib/artwork-content.ts';
import { createArtworkResources } from '../src/lib/artwork-resources.ts';
import { decodeEventBackgrounds } from '../src/lib/event-backgrounds.ts';
import { prepareDefinition, uploadDefinition } from '../supabase/scripts/manage-artwork.mjs';
const home=readFileSync('assets/characters/bunny/bunny-home-bungeoppang.png'),focus=readFileSync('assets/characters/bunny/bunny-focus-bungeoppang.png');
const config={theme:'winter',kind:'skin',character:'bunny',id:'bungeoppang-bunny',name:'붕어빵 토끼'};
const skin=()=>prepareDefinition(config,home,focus);
test('theme definitions prepare without a revision UUID and support explicit filenames',async()=>{
 const m=await skin();assert.equal(m.schemaVersion,2);assert.equal(m.revision,undefined);assert.equal(m.home.path,'winter/skins/bungeoppang-bunny/home.png');
 const changed=await prepareDefinition({...config,home:'winter/skins/bungeoppang-bunny/home-2.png'},home,focus);assert.equal(changed.home.path,'winter/skins/bungeoppang-bunny/home-2.png');
 assert.throws(()=>decodeArtwork({...m,revision:'00000000-0000-4000-8000-000000000001'}));
});
test('themed paths must stay inside their theme and asset category',async()=>{
 const m=await skin();
 for(const path of ['../home.png','winter/skins/../home.png','halloween/skins/bunny/home.png','winter/backgrounds/home.png','https://x.test/home.png','winter/skins/home.png?x=1'])assert.throws(()=>decodeArtwork({...m,home:{...m.home,path}}));
 assert.throws(()=>decodeArtwork({...m,theme:'winter/..'}));
});
test('same filenames use content hashes for image cache freshness',async()=>{
 const m=await skin(),base='https://x.supabase.co';
 const first=artworkUrl(base,m.home),second=artworkUrl(base,{...m.home,sha256:'a'.repeat(64)});
 assert.notEqual(first,second);assert(first.includes('winter/skins/'));assert(first.endsWith(`?hash=${m.home.sha256}`));
});
test('themed uploads verify both files and register directly without stage or publish UUIDs',async()=>{
 const m=await skin(),calls=[];
 const request=async(url,options={})=>{const parsed=new URL(url);calls.push({path:parsed.pathname,options});if(parsed.pathname.includes('/object/public/'))return new Response(parsed.pathname.endsWith('home.png')?home:focus,{headers:{'content-type':'image/png'}});return Response.json({ok:true});};
 await uploadDefinition({base:'https://x.supabase.co',key:'test-only',manifest:m,homeBytes:home,focusBytes:focus,activate:true,request});
 assert.equal(calls[4].path,'/rest/v1/rpc/admin_register_artwork');assert.equal(JSON.parse(calls[4].options.body).p_activate,true);
 assert(!calls.some(c=>/stage|publish/.test(c.path)));assert.equal(calls[0].options.headers['x-upsert'],'false');
});
test('same asset path with changed metadata prepares again and stale work cannot win',async()=>{
 const m=await skin();let release;const gate=new Promise(done=>release=done);
 const store=createArtworkResources({now:()=>1,fetchSkins:async()=>[],prepare:async a=>{if(a.home.sha256===m.home.sha256)await gate;}});
 const first=store.ingest(m),newer={...m,home:{...m.home,sha256:'a'.repeat(64)}};
 await store.ingest(newer);release();await first;assert.equal(store.read().get(`skin:${m.id}`).manifest.home.sha256,'a'.repeat(64));store.dispose();
});
test('themed backgrounds select a reusable library reference, with no version UUID',async()=>{
 const m=await prepareDefinition({theme:'halloween',kind:'background',name:'핼러윈'},readFileSync('assets/backgrounds/home-background-halloween.png'),readFileSync('assets/backgrounds/focus-background-halloween.png'));
 assert.equal(m.id,'halloween-room');assert.equal(m.home.path,'halloween/backgrounds/home.png');assert.equal(artworkReference(m),'asset-halloween-room');
 const snapshot=decodeEventBackgrounds({serverNow:'2026-10-30T00:00:00Z',roomId:0,windows:[{id:'event',startsAt:'2026-10-29T00:00:00Z',endsAt:'2026-11-01T00:00:00Z',screens:['home'],homeAsset:'default',focusAsset:'default',artwork:m}]});
 assert.equal(snapshot.windows[0].homeAsset,'remote:asset-halloween-room:home');
 const store=createArtworkResources({now:()=>1,fetchSkins:async()=>[],prepare:async()=>{}});await store.ingest(m);await store.ingest({...m,name:'수정'});assert.equal(store.read().size,1);assert.equal(store.read().get('background:asset-halloween-room').manifest.name,'수정');store.dispose();
});
