import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeaveRequester } from '../src/lib/leave-request-core.ts';
import { StudyError } from '../src/lib/contracts.ts';
import { leaveRefreshKey } from '../src/lib/leave-refresh.ts';
const id = '00000000-0000-4000-8000-000000000001';
const intent = { action: 'schedule', date: '2026-11-02', revision: 3, grantId: null };
const result = { serverNow: '2026-11-01T00:00:00Z', data: { revision: 4, availableCount: 0, grants: [] } };
function setup(send) {
  const values = new Map();
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
  const deps = { uid: async () => 'u1', newId: () => id, storage, send };
  return { deps, values, client: createLeaveRequester(deps) };
}
test('double submit shares a request and persistence precedes transmission', async () => {
  let calls = 0;
  const x = setup(async request => { calls++; assert.equal(x.values.size, 1); assert.equal(request.requestId,id); return result; });
  await Promise.all([x.client.submit(intent), x.client.submit(intent)]);
  assert.equal(calls,1); assert.equal(x.values.size,0);
});
test('response loss survives restart with original request ID and revision', async () => {
  const seen=[]; let fail=true;
  const x=setup(async request => { seen.push(request); if(fail) throw new StudyError('NETWORK','lost'); return result; });
  await assert.rejects(x.client.submit(intent));
  assert.equal(x.values.size,1); fail=false;
  await createLeaveRequester(x.deps).resume();
  assert.deepEqual(seen[0],seen[1]); assert.equal(x.values.size,0);
});
test('different intent cannot overwrite uncertain request; definitive rejection clears it', async () => {
  let error = new StudyError('NETWORK','lost');
  const x=setup(async () => { throw error; });
  await assert.rejects(x.client.submit(intent));
  await assert.rejects(x.client.submit({...intent,date:'2026-11-03'}));
  assert.equal(x.values.size,1);
  error=new StudyError('VALIDATION','stale'); await assert.rejects(x.client.resume());
  assert.equal(x.values.size,0);
});
test('failed local persistence never sends; empty recovery never invents an action', async () => {
  let calls=0; const x=setup(async () => { calls++; return result; });
  assert.equal(await x.client.resume(),null);
  x.deps.storage.setItem=()=>{throw Error('storage');};
  await assert.rejects(x.client.submit(intent)); assert.equal(calls,0);
});
test('refresh key changes at goal and study-day boundaries, not every second', () => {
  const t={serverNow:'2026-10-26T06:00:00+09:00',data:{day:{studyDate:'2026-10-26',goalMinutes:1,closedSeconds:0,runningSeconds:0,attendance:'pending'},activeSession:{startedAt:'2026-10-26T06:00:00+09:00'}}};
  const start=Date.parse(t.serverNow);
  assert.equal(leaveRefreshKey(t,start+1000,null),leaveRefreshKey(t,start+59000,null));
  assert.notEqual(leaveRefreshKey(t,start+59000,null),leaveRefreshKey(t,start+60000,null));
  assert.equal(leaveRefreshKey(t,start+60000,null),leaveRefreshKey(t,start+61000,null));
  assert.notEqual(leaveRefreshKey(t,start+61000,null),leaveRefreshKey(t,start+86400000,null));
  const leave={serverNow:t.serverNow,data:{revision:0,availableCount:1,grants:[{id:'a',status:'AVAILABLE',expiresAt:new Date(start+5000).toISOString()}]}};
  assert.notEqual(leaveRefreshKey(t,start+4999,leave),leaveRefreshKey(t,start+5000,leave));
});
