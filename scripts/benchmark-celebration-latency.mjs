import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const require=createRequire(`${root}/package.json`);
const ts=require('typescript');
const {createHookRuntime}=await import(`${root}/tests/helpers/hooks.mjs`);
const model=await import(`${root}/src/features/celebrations/model.ts`);
const {getStudyDate}=await import(`${root}/src/lib/study-day.ts`);
const {displayedSeconds}=await import(`${root}/src/features/study/presentation.ts`);
const source=ts.transpileModule(readFileSync(`${root}/src/features/celebrations/AchievementCelebrations.tsx`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const epoch=Date.parse('2026-10-31T10:00:00+09:00');
const date='2026-10-31';
const makeDay=(date,achieved)=>({studyDate:date,goalMinutes:120,closedSeconds:achieved?7200:0,runningSeconds:0,attendance:'present',isRestDay:false});
async function trial({name,todayMs,historyMs,leaveMs,tickMs=0,reward=false,storageMs=5,fail=false}) {
 const runtime=createHookRuntime(); let now=epoch-1; const calls=[];
 const initial={serverNow:new Date(epoch-1000).toISOString(),data:{profile:{id:'owner'},day:{...makeDay(date,false),runningSeconds:7199},activeSession:{startedAt:new Date(epoch-7200000).toISOString()}}};
 const confirmed={serverNow:new Date(epoch+tickMs).toISOString(),data:{profile:{id:'owner'},day:makeDay(date,true),activeSession:null}};
 const study={today:initial,startupReady:true,busy:false,actionFailed:false,confirmToday:async()=>{calls.push('today:start');await pause(todayMs);calls.push('today:end');study.today=confirmed;return confirmed;}};
 const storage={getItem:async()=>{await pause(storageMs);return null;},setItem:async()=>{}};
 const modules={
 'react':runtime.react,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
 'react-native':{StyleSheet:{create:s=>s},View:'View'},'expo-router':{router:{navigate:()=>{}}},
 '@react-native-async-storage/async-storage':{default:storage},
 '../../components/IdentityProvider':{useIdentity:()=>({uid:'owner',profile:{id:'owner'},loading:false,error:null})},
 '../../components/StartupBoundary':{useStartupVisible:()=>true},
 '../../data/study':{getHistory:async()=>{calls.push('history:start');await pause(historyMs);calls.push('history:end');return {data:model.weekDates(date).slice(0,6).map(d=>makeDay(d,reward||d===date))};}},
 '../../data/leave':{getLeaveStatus:async()=>{calls.push('leave:start');await pause(leaveMs);calls.push('leave:end');if(fail)throw Error('simulated request failure');return {data:{grants:reward?[{kind:'reward',earningWeek:'2026-10-26',earnedAt:new Date(epoch).toISOString(),status:'AVAILABLE'}]:[]}};}},
 '../../lib/room':{studyRoomId:0},'../../lib/study-day':{getStudyDate},
 '../study/StudyProvider':{useStudy:()=>study},'../study/study-clock':{useStudyNow:()=>now},'../study/presentation':{displayedSeconds},
 './model':model,'./CelebrationToast':{CelebrationToast:'Toast'},'./useToastEnvironment':{useToastEnvironment:()=>({ready:true,active:true,blocked:false,reducedMotion:false,screenReader:false})},
 };
 const context={exports:{},require:name=>{assert.ok(name in modules,name);return modules[name];}};
 vm.runInNewContext(source,context);
 const render=()=>runtime.render(()=>context.exports.AchievementCelebrations());
 assert.equal(render(),null,'No toast before 2 hours');
 const started=performance.now();await pause(tickMs); now=epoch+tickMs;
 let output=render();const detection=performance.now()-started;
 while(!output&&performance.now()-started<tickMs+todayMs+Math.max(historyMs,leaveMs)+150){await pause(2);output=render();}
 const total=performance.now()-started;
 if(fail)assert.equal(output,null,'Failed server request must not show toast');
 else {assert.equal(output.props.children.type,'Toast');assert.equal(output.props.children.props.notice.reward,reward);}
 runtime.dispose();
 return {name,todayMs,historyMs,leaveMs,tickMs,reward,shown:!!output,detectMs:Math.round(detection),toastMountedMs:output?Math.round(total):null,callOrder:calls};
}
const cases=[
 {name:'zero-network baseline',todayMs:0,historyMs:0,leaveMs:0},
 {name:'100ms RPC / goal',todayMs:100,historyMs:100,leaveMs:100},
 {name:'100ms RPC / reward',todayMs:100,historyMs:100,leaveMs:100,reward:true},
 {name:'500ms RPC / goal',todayMs:500,historyMs:500,leaveMs:500},
 {name:'1500ms RPC / goal',todayMs:1500,historyMs:1500,leaveMs:1500},
 {name:'slow leave only / goal',todayMs:100,historyMs:100,leaveMs:1500},
 {name:'100ms RPC + 900ms next tick',todayMs:100,historyMs:100,leaveMs:100,tickMs:900},
 {name:'leave failure / goal',todayMs:100,historyMs:100,leaveMs:200,fail:true},
];
const results=[];for(const c of cases){const row=await trial(c);results.push(row);console.log(JSON.stringify(row));}
writeFileSync('/private/tmp/celebration-latency-results.json',JSON.stringify({kind:'actual controller with injected RPC delays; not real device/network',results},null,2));
