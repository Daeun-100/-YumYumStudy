import test from 'node:test';
import assert from 'node:assert/strict';
import { createSharedRequest } from '../src/lib/shared-request.ts';
import { readVerifiedSession } from '../src/lib/identity-core.ts';
import { measure, getTimingSamples } from '../src/lib/performance.ts';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('concurrent refresh triggers share a read; later triggers read again', async () => {
  const share = createSharedRequest();
  const pending = deferred();
  let calls = 0;
  const run = () => { calls++; return pending.promise; };
  const first = share(0, run);
  assert.equal(share(0, run), first);
  await Promise.resolve();
  assert.equal(calls, 1);
  pending.resolve();
  await first;
  await share(0, run);
  assert.equal(calls, 2);
});

test('mutation gets a fresh request and obsolete completion cannot clear it', async () => {
  const share = createSharedRequest();
  const old = deferred(), fresh = deferred();
  const before = share(0, () => old.promise);
  const after = share(1, () => fresh.promise);
  assert.notEqual(before, after);
  old.resolve();
  await before;
  assert.equal(share(1, () => { throw Error('duplicate'); }), after);
  fresh.resolve();
  await after;
});

test('failed shared request releases its slot for retry', async () => {
  const share = createSharedRequest();
  await assert.rejects(share(0, async () => { throw Error('offline'); }));
  let retried = false;
  await share(0, async () => { retried = true; });
  assert.equal(retried, true);
});

test('verified timer owner uses session only; missing or changed identity fails closed', async () => {
  let sessions = 0;
  const auth = { getSession: async () => { sessions++; return { data: { session: { user: { id: 'owner' } } }, error: null }; } };
  assert.equal(await readVerifiedSession(auth, 'owner'), 'owner');
  assert.equal(sessions, 1);
  await assert.rejects(readVerifiedSession(auth, 'other'), { code: 'UNAUTHORIZED' });
  await assert.rejects(readVerifiedSession({ getSession: async () => ({ data: { session: null }, error: null }) }, 'owner'), { code: 'UNAUTHORIZED' });
  await assert.rejects(readVerifiedSession({ getSession: async () => ({ data: { session: null }, error: new TypeError('offline') }) }, 'owner'), { code: 'NETWORK' });
});

test('timings preserve return values/errors and retain only bounded metadata', async () => {
  assert.equal(await measure('test.success', async () => 42), 42);
  const failure = Error('private failure');
  await assert.rejects(measure('test.failure', async () => { throw failure; }), error => error === failure);
  assert.equal(getTimingSamples().at(-1).outcome, 'error');
  for (let i = 0; i < 205; i++) await measure('test.bounded', async () => null);
  const samples = getTimingSamples();
  assert.equal(samples.length, 200);
  assert.deepEqual(Object.keys(samples[0]).sort(), ['durationMs', 'name', 'outcome']);
  samples[0].name = 'changed';
  assert.equal(getTimingSamples()[0].name, 'test.bounded');
});

test('events during a running read queue one trailing read for the latest snapshot', async () => {
  const share = createSharedRequest();
  const pending = deferred();
  let snapshot = 0;
  let calls = 0;
  const first = share(0, async () => { calls++; await pending.promise; snapshot = 1; });
  await Promise.resolve();
  assert.equal(share(0, async () => { calls++; snapshot = 2; }, true), first);
  assert.equal(share(0, async () => { calls++; snapshot = 3; }, true), first);
  pending.resolve();
  await first;
  assert.equal(calls, 2);
  assert.equal(snapshot, 3);
});
