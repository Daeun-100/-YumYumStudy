import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeProfile, decodeRoom } from '../src/data/decode.ts';
import { decodeOwnedSkins, decodeSkinId, supportsSkin } from '../src/lib/skins.ts';

test('unknown OTA skin IDs survive profile and friend decoding', () => {
 const profile = { id:'friend',displayName:'친구',character:'bunny',activeSkinId:'bunny-future',skinUpdatedAt:'2026-10-28T00:00:00Z' };
 assert.deepEqual(decodeProfile(profile),profile);
 const today={studyDate:'2026-10-28',closedSeconds:0,runningSeconds:0,goalMinutes:null,attendance:'pending',isRestDay:false,goalAchieved:null};
 assert.equal(decodeRoom([{profile,today,activeSession:null}])[0].profile.activeSkinId,'bunny-future');
 assert.equal(supportsSkin('bunny',profile.activeSkinId,{'bunny-toothache':{character:'bunny'}}),false);
});
test('unknown or mismatched skin artwork safely uses the character default',()=>{
 const registry={'bunny-toothache':{character:'bunny'}};
 assert.equal(supportsSkin('bunny','bunny-toothache',registry),true);
 for(const id of [null,undefined,'bunny-missing','constructor','toString']) assert.equal(supportsSkin('bunny',id,registry),false);
 assert.equal(supportsSkin('bear','bunny-toothache',registry),false);
});
test('skin IDs and owned definitions reject malformed server input',()=>{
 assert.equal(decodeSkinId(null),null); assert.equal(decodeSkinId(undefined),null);
 for(const id of ['',{},5,'x/y','a'.repeat(81)]) assert.throws(()=>decodeSkinId(id));
 const item={id:'bunny-toothache',name:'치통 토끼',character:'bunny',grantedAt:'2026-10-28T00:00:00Z'};
 assert.deepEqual(decodeOwnedSkins([item]),[item]);
 for(const value of [null,{},[null],[{...item,grantedAt:'invalid'}],[{...item,character:'nope'}]]) assert.throws(()=>decodeOwnedSkins(value));
});
