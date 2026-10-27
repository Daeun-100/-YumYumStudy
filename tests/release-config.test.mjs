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
