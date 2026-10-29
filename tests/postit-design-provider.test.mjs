import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createHookRuntime} from './helpers/hooks.mjs';
import * as designs from '../src/features/postits/designs.ts';
const source=ts.transpileModule(readFileSync(new URL('../src/features/postits/PostitDesignProvider.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const revision='00000000-0000-4000-8000-000000000001';
const owned=[{grantId:revision,grantedAt:'2026-10-31T00:00:00Z',artwork:{schemaVersion:2,theme:'halloween',kind:'postit',id:'remote-paper',revision,name:'할로윈 종이',fallbackColor:'#F9E8A0',textColor:'#453F30',paper:{path:'halloween/postits/remote-paper/paper.png',sha256:'a'.repeat(64),bytes:100,width:1024,height:1024}}}];
const response=(items=owned,wait=null)=>({serverNow:'2026-10-31T00:00:00Z',owned:items,visible:[],nextCheckSeconds:wait});
function setup(){
 const hooks=createHookRuntime(),timers=new Map(),room={studyRoomId:0},storage=new Map(),toasts=[],study={today:null,busy:false};
 let owner='owner',active=true,next=1,reads=0,reply=response(),held=null,heldCache=null,online=true;
 const toast={show:o=>{toasts.push(o);return 'notice';}};
 const modules={react:hooks.react,'react/jsx-runtime':{jsx:(_type,props)=>({props})},'@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async k=>heldCache??storage.get(k)??null,setItem:async(k,v)=>storage.set(k,v)}},
 '../../components/IdentityProvider':{useIdentity:()=>({profile:owner?{id:owner}:null})},'../../hooks/useAppActive':{useAppActive:()=>active},'../../lib/room':room,
 '../../data/rpc':{callRpc:async()=>{reads++;if(held)return held;if(!online)throw Error('offline');return reply;}},'../../design/toast':{useToast:()=>toast},'../study/StudyProvider':{useStudy:()=>study},'../artwork/ArtworkProvider':{prepareArtworkFile:async()=>{}},'./designs':designs};
 const context={exports:{},require:n=>{assert.ok(n in modules,n);return modules[n];},Date,setTimeout:(run,ms)=>{const id=next++;timers.set(id,{run,ms});return id;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(source,context);
 const render=()=>hooks.render(()=>context.exports.PostitDesignProvider({children:null})).props.value;
 return {render,room,study,storage,toasts,timers,reads:()=>reads,reply:r=>reply=r,hold:p=>held=p,cacheHold:p=>heldCache=p,owner:v=>owner=v,active:v=>active=v,online:v=>online=v,dispose:()=>hooks.dispose()};
}
test('server-confirmed ownership is visible before images and notice persists only on display',async()=>{
 const h=setup();h.render();await flush();assert.equal(h.render().owned.length,1);await flush();assert.equal(h.toasts.length,1);
 const key=h.toasts[0].dedupeKey;assert.equal(h.storage.has(key),false);h.toasts[0].onShow();await flush();assert.equal(h.storage.get(key),'1');h.dispose();
});
test('server schedules a single threshold check without recurring polling; inactive clears it',async()=>{
 const h=setup();h.reply(response([],10));h.render();await flush();h.render();assert.equal(h.timers.size,1);
 h.active(false);h.render();assert.equal(h.timers.size,0);h.active(true);h.render();await flush();h.render();assert.equal(h.reads(),2);h.dispose();
});
test('old-room responses and old cache cannot leak through A to B to A transitions',async()=>{
 const h=setup();let resolve;h.hold(new Promise(done=>resolve=done));h.render();h.room.studyRoomId=1;h.hold(null);h.reply(response([]));h.render();await flush();assert.equal(h.render().owned.length,0);
 h.room.studyRoomId=0;h.render();await flush();assert.equal(h.render().owned.length,0);resolve(response());await flush();assert.equal(h.render().owned.length,0);h.dispose();
});
test('late disk cache cannot overwrite a fresh empty server response',async()=>{
 const h=setup();let resolve;h.cacheHold(new Promise(done=>resolve=done));h.reply(response([]));h.render();await flush();assert.equal(h.render().owned.length,0);
 resolve(JSON.stringify(response()));await flush();assert.equal(h.render().owned.length,0);h.dispose();
});
test('offline failure keeps owned designs and successful refresh clears the error',async()=>{
 const h=setup();h.render();await flush();h.online(false);await h.render().refresh();assert.equal(h.render().owned.length,1);assert.ok(h.render().error);
 h.online(true);await h.render().refresh();assert.equal(h.render().error,null);h.dispose();
});
