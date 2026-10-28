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

test('rapid tab returns reuse fresh values; expiry and retry fetch without clearing them', async t => {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  const cache = createMemoryCache();
  let calls = 0;
  const loader = async () => ++calls;
  await cache.load('week', loader, 30000);
  now += 29999;
  assert.equal(await cache.load('week', loader, 30000), 1);
  assert.equal(calls, 1);
  now++;
  assert.equal(await cache.load('week', loader, 30000), 2);
  assert.equal(await cache.load('week', loader, 30000, '', true), 3);
});

test('simultaneous focus and resume share a fetch; semantic changes fetch once more', async () => {
  const cache = createMemoryCache();
  let calls = 0, complete;
  const first = cache.load('week', () => { calls++; return new Promise(resolve => { complete = resolve; }); }, 30000, 'running');
  const same = cache.load('week', async () => { calls++; return 'duplicate'; }, 30000, 'running');
  await Promise.resolve();
  const changed = cache.load('week', async () => { calls++; return 'stopped'; }, 30000, 'stopped');
  complete('running');
  await Promise.all([first, same, changed]);
  assert.equal(calls, 2);
  assert.equal(cache.read('week'), 'stopped');
  await cache.load('week', async () => { throw Error('must use cache'); }, 30000, 'stopped');
});

test('mutation invalidates matching room only and keeps previous values visible', async () => {
  const cache = createMemoryCache();
  await cache.load('room0', async () => 'old');
  await cache.load('room1', async () => 'other');
  cache.invalidate(key => key === 'room0');
  assert.equal(cache.read('room0'), 'old');
  await cache.load('room1', async () => { throw Error('unrelated room refetched'); });
  await assert.rejects(cache.load('room0', async () => { throw Error('offline'); }));
  assert.equal(cache.read('room0'), 'old');
  assert.equal(await cache.load('room0', async () => 'new'), 'new');
});

test('late response from before a mutation cannot make the cache fresh', async () => {
  const cache = createMemoryCache();
  let complete;
  const pending = cache.load('day', () => new Promise(resolve => { complete = resolve; }));
  await Promise.resolve();
  cache.invalidate(() => true);
  complete('pre-mutation');
  await pending;
  assert.equal(await cache.load('day', async () => 'post-mutation'), 'post-mutation');
});

test('persisted records display immediately but always revalidate on first use', async () => {
  const cache = createMemoryCache(80, { load: async () => 'disk', save: async () => {} });
  await cache.hydrate('day');
  assert.equal(cache.read('day'), 'disk');
  assert.equal(cache.isRestored('day'), true);
  await cache.load('day', async () => 'server');
  assert.equal(cache.read('day'), 'server');
  assert.equal(cache.isRestored('day'), false);
});
