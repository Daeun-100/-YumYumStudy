import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudyStarter } from '../src/lib/study-start-core.ts';

const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const key = 'yumyumstudy.pending-study-start.user-a';
const result = { serverNow: '2026-10-26T00:00:00Z', data: { id: 'session-a', userId: 'user-a', startedAt: '2026-10-26T00:00:00Z', endedAt: null } };
function fixture() {
  const values = new Map();
  const calls = [];
  let creates = 0;
  const storage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  };
  const deps = {
    getUid: async () => 'user-a', storage,
    newId: () => (++creates === 1 ? a : b),
    send: async (id) => { calls.push(id); assert.equal(values.get(key), id); return result; },
  };
  return { values, calls, deps, creates: () => creates, make: () => createStudyStarter(deps) };
}

test('persist before sending, coalesce double taps, clear only after acknowledgement', async () => {
  const f = fixture();
  const starter = f.make();
  const first = starter.start();
  assert.equal(starter.start(), first);
  assert.deepEqual(await first, result);
  assert.deepEqual(f.calls, [a]);
  assert.equal(f.values.has(key), false);
  await starter.start();
  assert.deepEqual(f.calls, [a, b]);
});

test('server accepted but response lost: recreate app and retry same ID, even if session ended', async () => {
  const f = fixture();
  const sessions = new Map();
  let loseResponse = true;
  f.deps.send = async (id) => {
    f.calls.push(id);
    if (!sessions.has(id)) sessions.set(id, structuredClone(result));
    if (loseResponse) { loseResponse = false; throw new TypeError('response lost'); }
    return sessions.get(id);
  };
  await assert.rejects(f.make().start(), { code: 'NETWORK' });
  assert.equal(f.values.get(key), a);
  sessions.get(a).data.endedAt = '2026-10-26T00:10:00Z';
  const restored = await f.make().resume();
  assert.equal(restored.data.endedAt, '2026-10-26T00:10:00Z');
  assert.equal(sessions.size, 1);
  assert.deepEqual(f.calls, [a, a]);
  assert.equal(f.creates(), 1);
  assert.equal(f.values.has(key), false);
});

test('launch without pending request never starts study; a concurrent press still starts', async () => {
  const f = fixture();
  const starter = f.make();
  const recovery = starter.resume();
  const press = starter.start();
  assert.equal(await recovery, null);
  assert.deepEqual(await press, result);
  assert.equal(await f.make().resume(), null);
  assert.deepEqual(f.calls, [a]);
});

test('storage failures and corrupted requests block sending without replacing the request', async () => {
  for (const mode of ['read', 'write', 'corrupt']) {
    const f = fixture();
    if (mode === 'read') f.deps.storage.getItem = async () => { throw Error('unavailable'); };
    if (mode === 'write') f.deps.storage.setItem = async () => { throw Error('full'); };
    if (mode === 'corrupt') f.values.set(key, 'broken');
    await assert.rejects(f.make().start(), { code: 'UNKNOWN' });
    assert.deepEqual(f.calls, []);
    if (mode === 'corrupt') assert.equal(f.values.get(key), 'broken');
  }
});

test('failed cleanup keeps the ID for safe retries', async () => {
  const f = fixture();
  const originalRemove = f.deps.storage.removeItem;
  f.deps.storage.removeItem = async () => { throw Error('unavailable'); };
  await assert.rejects(f.make().start());
  assert.equal(f.values.get(key), a);
  f.deps.storage.removeItem = originalRemove;
  await f.make().resume();
  assert.deepEqual(f.calls, [a, a]);
  assert.equal(f.values.has(key), false);
});

test('repeated offline attempts reuse the saved request and failed authentication never sends', async () => {
  const f = fixture();
  const send = f.deps.send;
  f.deps.send = async (id) => { f.calls.push(id); throw new TypeError('offline'); };
  const starter = f.make();
  await assert.rejects(starter.start(), { code: 'NETWORK' });
  await assert.rejects(starter.start(), { code: 'NETWORK' });
  await assert.rejects(f.make().resume(), { code: 'NETWORK' });
  assert.deepEqual(f.calls, [a, a, a]);
  assert.equal(f.creates(), 1);
  f.deps.getUid = async () => { throw new TypeError('auth unavailable'); };
  await assert.rejects(f.make().resume(), { code: 'NETWORK' });
  assert.equal(f.calls.length, 3);
  assert.equal(f.values.get(key), a);
  f.deps.getUid = async () => 'user-a';
  f.deps.send = send;
  await f.make().resume();
  assert.deepEqual(f.calls, [a, a, a, a]);
});

test('requests are scoped to UID and mismatched responses are retained', async () => {
  const f = fixture();
  f.values.set('yumyumstudy.pending-study-start.other-user', b);
  f.deps.send = async () => ({ ...result, data: { ...result.data, userId: 'other-user' } });
  await assert.rejects(f.make().start(), { code: 'UNAUTHORIZED' });
  assert.equal(f.values.get(key), a);
  assert.equal(f.values.get('yumyumstudy.pending-study-start.other-user'), b);
});
