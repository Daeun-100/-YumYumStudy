import test from 'node:test';
import assert from 'node:assert/strict';
import {createArtworkResources} from '../src/lib/artwork-resources.ts';
import {decodeArtwork,artworkUrl} from '../src/lib/artwork-content.ts';
const firstHash='a'.repeat(64);
export function manifest(overrides={}){
 const m={schemaVersion:2,theme:'winter',kind:'skin',id:'remote-bunny',name:'remote bunny',character:'bunny',effects:[],...overrides};
 const file=screen=>({path:`${m.theme}/${m.kind==='skin'?`skins/${m.id}`:`backgrounds/${m.id}`}/${screen}.png`,sha256:overrides.sha256??firstHash,bytes:100,width:screen==='home'?1536:m.kind==='skin'?1254:1024,height:screen==='home'?1024:m.kind==='skin'?1254:1536});
 return {...m,home:file('home'),focus:file('focus')};
}
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
test('remote content rejects arbitrary hosts, paths, sizes and schema versions',()=>{
 const m=manifest();assert.equal(decodeArtwork(m).theme,'winter');
 for(const change of [{schemaVersion:1},{id:undefined},{home:{...m.home,path:'../outside.png'}},{focus:{...m.focus,width:2048}},{home:{...m.home,bytes:6*1024*1024}}])assert.throws(()=>decodeArtwork({...m,...change}));
 for(const url of ['http://x.supabase.co','https://x.example.com','https://user:pass@x.supabase.co','https://x.supabase.co/other'])assert.throws(()=>artworkUrl(url,m.home));
 assert.equal(artworkUrl('https://x.supabase.co',m.home),`https://x.supabase.co/storage/v1/object/public/event-artwork/${m.home.path}?hash=${m.home.sha256}`);
});
test('unknown effects leave images usable; supported effect parameters are bounded',()=>{
 const m=manifest();assert.deepEqual(decodeArtwork({...m,effects:[{kind:'future-effect'}]}).effects,[]);
 const pos={x:.5,y:.2,width:.1,opacity:.5};
 assert.equal(decodeArtwork({...m,effects:[{kind:'warmSteam',home:pos,focus:pos}]}).effects.length,1);
 assert.throws(()=>decodeArtwork({...m,effects:[{kind:'warmSteam',home:{...pos,width:10},focus:pos}]}));
});
test('same skin requests share a fetch and become ready only after both images prepare',async()=>{
 const gate=deferred();let reads=0;const store=createArtworkResources({now:()=>1,fetchSkins:async()=>{reads++;return[manifest()];},prepare:()=>gate.promise});
 const first=store.requestSkins(['remote-bunny']),second=store.requestSkins(['remote-bunny']);await flush();assert.equal(reads,1);assert.equal(store.read().get('skin:remote-bunny').state,'loading');
 gate.resolve();await Promise.all([first,second]);assert.equal(store.read().get('skin:remote-bunny').state,'ready');store.dispose();
});
test('failed image preparation does not replace a verified previous image',async()=>{
 let fail=false;const store=createArtworkResources({now:()=>1,fetchSkins:async()=>[],prepare:async()=>{if(fail)throw Error('offline');}});
 await store.ingest(manifest());fail=true;await store.ingest(manifest({sha256:'b'.repeat(64)}));assert.equal(store.read().get('skin:remote-bunny').manifest.home.sha256,firstHash);store.dispose();
});
test('late preparation of an older image cannot replace newer artwork',async()=>{
 const first=deferred();const second='b'.repeat(64);
 const store=createArtworkResources({now:()=>1,fetchSkins:async()=>[],prepare:async m=>{if(m.home.sha256===firstHash)await first.promise;}});
 const slow=store.ingest(manifest());await store.ingest(manifest({sha256:second}));first.resolve();await slow;assert.equal(store.read().get('skin:remote-bunny').manifest.home.sha256,second);store.dispose();
});
test('an invalidation during an in-flight fetch queues one fresh read',async()=>{
 const gate=deferred();let reads=0;const store=createArtworkResources({now:()=>1,fetchSkins:async()=>{if(++reads===1)await gate.promise;return[manifest()];},prepare:async()=>{}});
 const first=store.requestSkins(['remote-bunny']);void store.refresh();void store.refresh();gate.resolve();await first;await flush();assert.equal(reads,2);store.dispose();
});
test('disposed identity stores cannot publish a late response or save metadata',async()=>{
 const gate=deferred();let saves=0;const store=createArtworkResources({now:()=>1,fetchSkins:async()=>{await gate.promise;return[manifest()];},prepare:async()=>{},save:()=>saves++});
 const task=store.requestSkins(['remote-bunny']);store.dispose();gate.resolve();await task;assert.equal(saves,0);assert.notEqual(store.read().get('skin:remote-bunny')?.state,'ready');
});
test('different background assets have distinct cache keys and invalid cached definitions are ignored',async()=>{
 const store=createArtworkResources({now:()=>1,fetchSkins:async()=>[],prepare:async()=>{}});await store.restore([manifest({schemaVersion:1})]);assert.equal(store.read().size,0);
 await store.ingest(manifest({kind:'background',id:'room'}));await store.ingest(manifest({kind:'background',id:'second-room'}));assert.equal(store.read().size,2);store.dispose();
});
test('unmounted skin consumers stop background refresh without dropping other consumers',async()=>{
 let reads=0;const store=createArtworkResources({now:()=>1,fetchSkins:async()=>{reads++;return[manifest()];},prepare:async()=>{}});
 const first=store.acquireSkins(['remote-bunny']),second=store.acquireSkins(['remote-bunny']);await flush();first();await store.refresh();assert.equal(reads,2);
 second();await store.refresh();assert.equal(reads,2);store.dispose();
});
test('cached metadata can prepare while startup network is pending and survives offline failure',async()=>{
 const gate=deferred();const store=createArtworkResources({now:()=>1,fetchSkins:async()=>{await gate.promise;throw Error('offline');},prepare:async()=>{}});
 const first=store.requestSkins(['remote-bunny']);await store.restore([manifest()]);assert.equal(store.read().get('skin:remote-bunny').state,'ready');
 gate.resolve();await first;assert.equal(store.read().get('skin:remote-bunny').state,'ready');store.dispose();
});
test('server denial cannot be overwritten by a late cache preparation',async()=>{
 const gate=deferred(),network=deferred();const store=createArtworkResources({now:()=>1,fetchSkins:async()=>{await network.promise;return[];},prepare:()=>gate.promise});
 const request=store.requestSkins(['remote-bunny']),restore=store.restore([manifest()]);network.resolve();await request;gate.resolve();await restore;
 assert.equal(store.read().get('skin:remote-bunny').state,'unsupported');store.dispose();
});
