import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeOnboarding, validateDisplayName } from '../src/lib/onboarding.ts';
test('onboarding resumes at invite, name or ready and rejects incomplete server state', () => {
  assert.deepEqual(decodeOnboarding({step:'invite',profile:null}),{step:'invite',profile:null});
  for (const step of ['name','ready']) {
    assert.equal(decodeOnboarding({step,profile:{id:'user',displayName:'다은'}}).step,step);
    assert.throws(()=>decodeOnboarding({step,profile:null}));
  }
  for (const value of [null,{}, {step:'unknown'}, {step:'ready',profile:{id:'',displayName:'x'}}]) assert.throws(()=>decodeOnboarding(value));
});
test('admission errors are actionable and do not become successful joins', () => {
  for (const error of ['INVITE_NOT_CONFIGURED','INVALID_INVITE','RATE_LIMITED']) {
    assert.throws(()=>decodeOnboarding({error}),e=>e.code==='VALIDATION');
  }
});
test('names trim outside whitespace, allow duplicate names, and count Unicode code points', () => {
  assert.equal(validateDisplayName(' 다은 '),'다은');
  assert.equal(validateDisplayName('다은'),'다은');
  assert.equal(validateDisplayName('🍉'.repeat(12)),'🍉'.repeat(12));
  for (const name of ['','   ','x'.repeat(13),'🍉'.repeat(13),'가\n나']) assert.throws(()=>validateDisplayName(name));
});
