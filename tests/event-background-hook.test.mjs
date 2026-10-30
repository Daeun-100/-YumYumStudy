import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createHookRuntime} from './helpers/hooks.mjs';
import * as backgrounds from '../src/lib/event-backgrounds.ts';
const source=ts.transpileModule(readFileSync(new URL('../src/features/events/useEventBackgrounds.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
function setup() {
 const hooks=createHookRuntime(),timers=new Map(),room={studyRoomId:0};
 let now=Date.parse('2026-10-31T00:00:00Z'),nextTimer=0,focused=true,active=true,online=true,reads=0,signal,connection,hold;
 let windows=[{id:'test',startsAt:new Date(now+1000).toISOString(),endsAt:new Date(now+3000).toISOString(),screens:['home','focus'],homeAsset:'halloween-home',focusAsset:'halloween-focus'}];
 class Clock extends Date {static now(){return now;}}
 const modules={react:hooks.react,'../artwork/ArtworkContext':{ArtworkContext:{value:null}},'../../components/IdentityProvider':{useIdentity:()=>({profile:{id:'owner'}})},'../../hooks/useAppActive':{useAppActive:()=>active},'../../lib/room':room,
  '../../lib/event-backgrounds':backgrounds,'../../data/rpc':{callRpc:async(_name,args)=>{reads++;if(hold)return hold;if(!online)throw Error('offline');return{serverNow:new Date(now).toISOString(),roomId:args.p_room_id,windows:room.studyRoomId===0?windows:[]};}},
  '../../lib/supabase':{getSupabase:()=>({channel:()=>({on(_type,_filter,callback){signal=callback;return this;},subscribe(callback){connection=callback;return this;}}),removeChannel:async()=>{signal=undefined;connection=undefined;}})}};
 const context={exports:{},require:name=>{assert.ok(name in modules,name);return modules[name];},Date:Clock,setTimeout:(callback,delay)=>{const id=++nextTimer;timers.set(id,{callback,at:now+delay});return id;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(source,context);
 const render=()=>hooks.render(()=>context.exports.useEventBackgrounds(focused));
 return {render,room,reads:()=>reads,online:v=>{online=v;},focus:v=>{focused=v;},active:v=>{active=v;},windows:v=>{windows=v;},signal:()=>signal?.(),reconnect:()=>connection?.('SUBSCRIBED'),hold:p=>{hold=p;},dispose:()=>hooks.dispose(),timers,
 async advance(ms){const end=now+ms;while(true){const entry=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!entry||entry[1].at>end)break;now=entry[1].at;timers.delete(entry[0]);entry[1].callback();render();await flush();render();}now=end;await flush();return render();}};
}
test('background starts and ends through realtime without boundary timers or periodic reads',async()=>{
 const h=setup();h.render();await flush();h.render();
 assert.equal(h.reads(),1);assert.equal(h.render().home,undefined);assert.equal(h.timers.size,0);
 await h.advance(1100);assert.equal(h.render().home,undefined);assert.equal(h.reads(),1);
 h.signal();await flush();assert.equal(h.render().home,'halloween-home');
 await h.advance(2000);assert.equal(h.render().home,'halloween-home');assert.equal(h.reads(),2);
 h.signal();await flush();assert.equal(h.render().home,undefined);assert.equal(h.reads(),3);
 await h.advance(600000);assert.equal(h.reads(),3);assert.equal(h.timers.size,0);h.dispose();
});
test('a missed offline end is refreshed when realtime reconnects',async()=>{
 const h=setup();h.render();await flush();await h.advance(1100);
 h.signal();await flush();assert.equal(h.render().home,'halloween-home');
 h.online(false);await h.advance(5000);h.signal();await flush();
 assert.equal(h.render().home,'halloween-home');assert.equal(h.timers.size,0);
 h.online(true);h.reconnect();await flush();assert.equal(h.render().home,undefined);h.dispose();
});
test('realtime cancellation invalidates the displayed window',async()=>{
 const h=setup();h.render();await flush();await h.advance(1100);h.signal();await flush();assert.equal(h.render().home,'halloween-home');
 h.windows([]);h.signal();await flush();assert.equal(h.render().home,undefined);h.dispose();
});
test('screen reentry and app resume refresh missed changes without timers',async()=>{
 const h=setup();h.focus(false);h.render();await flush();assert.equal(h.reads(),0);
 h.focus(true);h.render();await flush();assert.equal(h.reads(),1);
 h.focus(false);h.render();await h.advance(1100);assert.equal(h.reads(),1);
 h.focus(true);h.render();await flush();assert.equal(h.render().home,'halloween-home');
 h.active(false);h.render();assert.equal(h.timers.size,0);
 await h.advance(5000);assert.equal(h.reads(),2);
 h.active(true);h.render();await flush();assert.equal(h.render().home,undefined);assert.equal(h.reads(),3);h.dispose();
});
test('a late response from the previous room cannot replace current-room background',async()=>{
 const h=setup();let resolve;h.hold(new Promise(done=>{resolve=done;}));h.render();
 h.room.studyRoomId=1;h.hold(null);h.render();await flush();assert.equal(h.render().home,undefined);
 resolve({serverNow:'2026-10-31T00:00:00Z',roomId:0,windows:[{id:'old',startsAt:'2026-10-30T00:00:00Z',endsAt:'2026-11-01T00:00:00Z',screens:['home'],homeAsset:'old-room',focusAsset:'old-room'}]});
 await flush();assert.equal(h.render().home,undefined);h.dispose();
});
