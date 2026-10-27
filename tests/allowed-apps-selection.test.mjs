import test from 'node:test';
import assert from 'node:assert/strict';
import { createAllowedAppsSelectionQueue } from '../src/features/allowed-apps/selection-queue.ts';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('only changed apps stay pending and sequential writes preserve rapid changes', async () => {
  let allowed = ['a'];
  const writes = [];
  const gate = deferred();
  let pending = [];
  const queue = createAllowedAppsSelectionQueue({
    status: async () => ({ allowed: [...allowed], running: false }),
    select: async value => { writes.push(value); if (writes.length === 1) await gate.promise; allowed = value; },
  }, { onPending: value => { pending = value; }, onStatus: () => {}, onError: error => { throw error; } });
  const first = queue.select('a', false);
  const second = queue.select('b', true);
  queue.select('a', true); // A disabled row cannot enqueue a duplicate change.
  assert.deepEqual(pending, ['a', 'b']);
  assert.equal(pending.includes('c'), false, 'other rows remain available');
  const revision = queue.revision;
  gate.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(writes, [[], ['b']]);
  assert.deepEqual(allowed, ['b']);
  assert.deepEqual(pending, []);
  assert.equal(queue.pending, false);
  assert.ok(queue.revision > revision, 'stale polling responses can be discarded');
});

test('a failed write unlocks its row and later queued changes still save', async () => {
  let allowed = ['a'];
  const errors = [];
  let pending;
  let attempts = 0;
  const queue = createAllowedAppsSelectionQueue({
    status: async () => ({ allowed: [...allowed], running: false }),
    select: async value => { if (++attempts === 1) throw new Error('save failed'); allowed = value; },
  }, { onPending: value => { pending = value; }, onStatus: () => {}, onError: error => errors.push(error.message) });
  queue.select('a', false);
  await queue.select('b', true);
  assert.deepEqual(errors, ['save failed']);
  assert.deepEqual(allowed, ['a', 'b']);
  assert.deepEqual(pending, []);
});

test('study starting before a queued write blocks changes and releases the lock', async () => {
  let writes = 0;
  const errors = [];
  const queue = createAllowedAppsSelectionQueue({ status: async () => ({ allowed: [], running: true }), select: async () => { writes++; } }, {
    onPending: () => {}, onStatus: () => {}, onError: error => errors.push(error.message),
  });
  await queue.select('a', true);
  assert.equal(writes, 0);
  assert.equal(errors.length, 1);
  assert.equal(queue.pending, false);
});
