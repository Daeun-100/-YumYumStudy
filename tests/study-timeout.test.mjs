import test from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout } from '../src/lib/with-timeout.ts';
import { createNetworkFetch } from '../src/lib/network-fetch.ts';

test('a stalled study/auth operation releases UI with a retryable error', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 10, '다시 확인해 주세요'), error => error.code === 'NETWORK' && error.message === '다시 확인해 주세요');
  assert.equal(await withTimeout(Promise.resolve('retry succeeded'), 100, 'timeout'), 'retry succeeded');
});
test('network deadline aborts the real request and permits a later request', async () => {
  let calls = 0;
  const bounded = createNetworkFetch(async (_, options) => {
    if (++calls > 1) return new Response('ok');
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
  }, 10);
  await assert.rejects(bounded('https://example.com'), { name: 'AbortError' });
  assert.equal(await (await bounded('https://example.com')).text(), 'ok');
});
test('RPC cancellation is preserved by the authentication network deadline', async () => {
  const upstream = new AbortController();
  const bounded = createNetworkFetch(async (_, options) => new Promise((_, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }), 1000);
  const request = bounded('https://example.com', { signal: upstream.signal });
  upstream.abort();
  await assert.rejects(request, { name: 'AbortError' });
});

import { createTimerMode, needsStudyGuard, isBasicSession } from '../src/features/study/timer-mode-core.ts';
test('missing either permission selects basic timer instead of blocking study', () => {
  for (const [usageAccess, notificationAccess] of [[false, false], [true, false], [false, true]]) {
    assert.equal(needsStudyGuard({ usageAccess, notificationAccess, allowed: ['app'] }, null), false);
  }
  assert.equal(needsStudyGuard({ usageAccess: true, notificationAccess: true, allowed: ['app'] }, null), true);
  assert.equal(needsStudyGuard({ usageAccess: true, notificationAccess: true, allowed: ['app'] }, '*'), false);
});
test('basic timer survives restart and uncertain start without leaking across users or rooms', async () => {
  const values = new Map();
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } };
  let room = 0;
  const first = createTimerMode(storage, () => room);
  await first.set('owner', '*');
  const restarted = createTimerMode(storage, () => room);
  assert.equal(isBasicSession(await restarted.get('owner'), 'acknowledged-late'), true);
  assert.equal(await restarted.get('friend'), null);
  room = 1;
  assert.equal(await restarted.get('owner'), null);
  room = 0;
  await restarted.set('owner', 'session');
  assert.equal(isBasicSession(await restarted.get('owner'), 'session'), true);
  assert.equal(isBasicSession(await restarted.get('owner'), 'another-session'), false);
  await restarted.clear('owner');
  assert.equal(await restarted.get('owner'), null);
});

test('an empty allowed-app list or unavailable native status uses basic timer', () => {
  assert.equal(needsStudyGuard({ usageAccess: true, notificationAccess: true, allowed: [] }, null), false);
  assert.equal(needsStudyGuard(null, null), false);
});
