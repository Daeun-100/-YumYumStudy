import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryCache } from '../src/lib/memory-cache.ts';

test('cached data stays visible during refresh and a failed refresh', async () => {
  const cache = createMemoryCache();
  const key = JSON.stringify([0, 'alice', 'history', '2026-10-26']);
  await cache.refresh(key, async () => [1]);
  let complete;
  const pending = cache.refresh(key, () => new Promise(resolve => { complete = resolve; }));
  await Promise.resolve();
  assert.deepEqual(cache.read(key), [1]);
  complete([2]);
  await pending;
  assert.deepEqual(cache.read(key), [2]);
  await assert.rejects(cache.refresh(key, async () => { throw Error('offline'); }));
  assert.deepEqual(cache.read(key), [2]);
});
test('coalesces concurrent reads and notifies mounted screens', async () => {
  const cache = createMemoryCache();
  let calls = 0, updates = 0;
  const unsubscribe = cache.subscribe('key', () => updates++);
  const loader = async () => { calls++; return []; };
  await Promise.all([cache.refresh('key', loader), cache.refresh('key', loader)]);
  assert.equal(calls, 1);
  assert.equal(updates, 1);
  assert.deepEqual(cache.read('key'), []);
  unsubscribe();
  await cache.refresh('key', loader);
  assert.equal(updates, 1);
});
test('separates viewer, room and period, and bounds retained entries', async () => {
  const cache = createMemoryCache(2);
  const key = (room, uid, period) => JSON.stringify([room, uid, 'history', period]);
  await cache.refresh(key(0, 'alice', 'week'), async () => 'alice week');
  assert.equal(cache.read(key(1, 'alice', 'week')), undefined);
  assert.equal(cache.read(key(0, 'bob', 'week')), undefined);
  assert.equal(cache.read(key(0, 'alice', 'month')), undefined);
  await cache.refresh(key(0, 'alice', 'month'), async () => 'alice month');
  await cache.refresh(key(0, 'bob', 'week'), async () => 'bob week');
  assert.equal(cache.read(key(0, 'alice', 'week')), undefined);
  assert.equal(cache.read(key(0, 'alice', 'month')), 'alice month');
});
