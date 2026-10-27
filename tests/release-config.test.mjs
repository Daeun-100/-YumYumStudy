import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const config=require('../app.config.js');
test('test and production IDs differ, share project, and reject conflicting build flags',()=>{
 const before={app:process.env.APP_VARIANT,public:process.env.EXPO_PUBLIC_APP_VARIANT};
 try{
  process.env.APP_VARIANT='test';process.env.EXPO_PUBLIC_APP_VARIANT='test';const a=config();
  process.env.APP_VARIANT='production';process.env.EXPO_PUBLIC_APP_VARIANT='production';const b=config();
  assert.equal(a.android.package,'com.yumyumstudy.app.test');assert.equal(b.android.package,'com.yumyumstudy.app');
  assert.equal(a.extra.eas.projectId,b.extra.eas.projectId);assert.notEqual(a.scheme,b.scheme);
  process.env.EXPO_PUBLIC_APP_VARIANT='test';assert.throws(()=>config(),/mismatch/);
 } finally {
  for(const [key,v] of [['APP_VARIANT',before.app],['EXPO_PUBLIC_APP_VARIANT',before.public]]) {if(v===undefined)delete process.env[key];else process.env[key]=v;}
 }
});

test('existing APK runtime is used only by a verified production master OTA publish', () => {
 const names=['APP_VARIANT','EXPO_PUBLIC_APP_VARIANT','GITHUB_ACTIONS','GITHUB_REF','GITHUB_SHA','YUMYUM_OTA_RUNTIME','YUMYUM_OTA_SOURCE','EAS_BUILD'];
 const before=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 try {
  Object.assign(process.env,{APP_VARIANT:'production',EXPO_PUBLIC_APP_VARIANT:'production',GITHUB_ACTIONS:'true',GITHUB_REF:'refs/heads/master',
   GITHUB_SHA:'a'.repeat(40),YUMYUM_OTA_SOURCE:'a'.repeat(40),YUMYUM_OTA_RUNTIME:'c'.repeat(40)});
  delete process.env.EAS_BUILD;
  assert.equal(config().runtimeVersion,'c'.repeat(40));
  for(const [name,value] of [['GITHUB_REF','refs/heads/develop'],['YUMYUM_OTA_SOURCE','b'.repeat(40)],['EAS_BUILD','true'],['GITHUB_ACTIONS','false']]){
   const old=process.env[name];process.env[name]=value;assert.throws(()=>config(),/verified production master/);
   if(old===undefined)delete process.env[name];else process.env[name]=old;
  }
  delete process.env.YUMYUM_OTA_RUNTIME;
  assert.deepEqual(config().runtimeVersion,{policy:'fingerprint'});
 } finally { for(const name of names){if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];} }
});
