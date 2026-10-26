import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveTestBuild,scopedRoomKey} from '../src/lib/room-core.ts';
test('explicit cloud build variant controls test access even in release mode',()=>{
 assert.equal(resolveTestBuild('test',false),true);
 assert.equal(resolveTestBuild('production',true),false);
 assert.equal(resolveTestBuild(undefined,true),true);
 assert.equal(resolveTestBuild(undefined,false),false);
 assert.throws(()=>resolveTestBuild('preview',false));
});
test('test room storage is isolated while production identity keys remain unchanged',()=>{
 const key='yumyumstudy.known-uid';
 assert.equal(scopedRoomKey(key,1),key);
 assert.notEqual(scopedRoomKey(key,0),scopedRoomKey(key,1));
});
