import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordHistoryCache } from '../src/lib/record-history-cache.ts';
import { createMemoryCache } from '../src/lib/memory-cache.ts';
const now = Date.parse('2026-10-27T09:00:00Z');
const key = (room = 0, uid = 'owner', from = '2026-10-26', to = '2026-10-27') => JSON.stringify([room, uid, 'history', from, to]);
const snapshot = (seconds = 60, serverNow = '2026-10-27T08:00:00Z') => ({ serverNow, data: [{ studyDate: '2026-10-26', closedSeconds: seconds, runningSeconds: 0, goalMinutes: 60, attendance: 'present', isRestDay: false, goalAchieved: false }] });
function storage() {
  let raw = null;
  return { getItem: async () => raw, setItem: async (_key, value) => { raw = value; }, raw: () => raw };
}
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };

test('own history survives restart, scoped by viewer, room and exact range', async () => {
  const disk = storage();
  await createRecordHistoryCache(disk, () => now).save(key(), snapshot());
  const restarted = createRecordHistoryCache(disk, () => now);
  assert.deepEqual(await restarted.load(key()), snapshot());
  for (const other of [key(1), key(0, 'other'), key(0, 'owner', '2026-10-25')]) assert.equal(await restarted.load(other), undefined);
});

test('friend history, sessions, timer snapshots, missing viewer and unsupported rooms never persist', async () => {
  const disk = storage(), cache = createRecordHistoryCache(disk, () => now);
  for (const parts of [[0, 'owner', 'member-history', 'friend', '2026-10-26', '2026-10-27'], [0, 'owner', 'sessions', 'self', '2026-10-26'], [0, 'owner', 'today'], [0, null, 'history', '2026-10-26', '2026-10-27'], [2, 'owner', 'history', '2026-10-26', '2026-10-27']]) {
    const invalid = JSON.stringify(parts);
    await cache.save(invalid, snapshot());
    assert.equal(await cache.load(invalid), undefined);
  }
  assert.equal(disk.raw(), null);
});

test('expired, corrupt, out-of-range and invalid snapshots are ignored', async () => {
  const disk = storage();
  await createRecordHistoryCache(disk, () => now).save(key(), snapshot());
  assert.equal(await createRecordHistoryCache(disk, () => now + 8 * 86400000).load(key()), undefined);
  for (const raw of ['broken', JSON.stringify({ version: 2, entries: [] }), JSON.stringify({ version: 1, entries: [{ key: key(), savedAt: now, value: { ...snapshot(), data: [{ ...snapshot().data[0], closedSeconds: -1 }] } }] }), JSON.stringify({ version: 1, entries: [{ key: key(), savedAt: now, value: { ...snapshot(), data: [{ ...snapshot().data[0], studyDate: '2026-10-25' }] } }] })]) {
    assert.equal(await createRecordHistoryCache({ getItem: async () => raw }, () => now).load(key()), undefined);
  }
});

test('disk cache is bounded and refuses an older server snapshot', async () => {
  const disk = storage(), cache = createRecordHistoryCache(disk, () => now, 2);
  await cache.save(key(0, 'owner'), snapshot(120));
  await cache.save(key(0, 'owner'), snapshot(10, '2026-10-27T07:00:00Z'));
  assert.equal((await cache.load(key())).data[0].closedSeconds, 120);
  await Promise.all([cache.save(key(0, 'second'), snapshot()), cache.save(key(0, 'third'), snapshot())]);
  const restarted = createRecordHistoryCache(disk, () => now, 2);
  assert.equal(await restarted.load(key()), undefined);
  assert.ok(await restarted.load(key(0, 'second')));
  assert.ok(await restarted.load(key(0, 'third')));
});

test('disk restore displays immediately while offline; server success replaces it', async () => {
  const disk = storage(), records = createRecordHistoryCache(disk, () => now);
  await records.save(key(), snapshot(60));
  const cache = createMemoryCache(80, createRecordHistoryCache(disk, () => now));
  await cache.hydrate(key());
  assert.equal(cache.read(key()).data[0].closedSeconds, 60);
  assert.equal(cache.isRestored(key()), true);
  await assert.rejects(cache.refresh(key(), async () => { throw Error('offline'); }));
  assert.equal(cache.read(key()).data[0].closedSeconds, 60);
  await cache.refresh(key(), async () => snapshot(120));
  assert.equal(cache.read(key()).data[0].closedSeconds, 120);
  assert.equal(cache.isRestored(key()), false);
});

test('slow disk cannot overwrite fresh network data and cache failure cannot fail a live read', async () => {
  const pending = deferred();
  const cache = createMemoryCache(80, { load: () => pending.promise, save: async () => { throw Error('disk full'); } });
  const restore = cache.hydrate(key());
  await cache.refresh(key(), async () => snapshot(120));
  pending.resolve(snapshot(60));
  await restore;
  assert.equal(cache.read(key()).data[0].closedSeconds, 120);
  assert.equal(cache.isRestored(key()), false);
});

test('changed loader during an in-flight history read fetches latest data, without publishing obsolete results', async () => {
  const cache = createMemoryCache();
  const pending = deferred();
  const seen = [];
  cache.subscribe(key(), () => seen.push(cache.read(key()).data[0].closedSeconds));
  const first = cache.refresh(key(), () => pending.promise);
  await Promise.resolve();
  const next = cache.refresh(key(), async () => snapshot(120), true);
  pending.resolve(snapshot(60));
  await Promise.all([first, next]);
  assert.deepEqual(seen, [120]);
});

test('a late disk read cannot resurrect an obsolete snapshot even after memory eviction', async () => {
  const pending = deferred();
  const cache = createMemoryCache(1, { load: () => pending.promise, save: async () => {} });
  const restore = cache.hydrate(key());
  await cache.refresh(key(), async () => snapshot(120));
  await cache.refresh(key(0, 'other'), async () => snapshot(180));
  pending.resolve(snapshot(60));
  await restore;
  assert.equal(cache.read(key()), undefined);
  assert.equal(cache.isRestored(key()), false);
});

test('cache storage failure never blocks a server result and extra active-session fields are dropped', async () => {
  const disk = storage(), records = createRecordHistoryCache(disk, () => now);
  await records.save(key(), { ...snapshot(), activeSession: { id: 'old-session' } });
  assert.equal(disk.raw().includes('old-session'), false);
  const broken = createRecordHistoryCache({ getItem: async () => { throw Error('locked'); }, setItem: async () => { throw Error('full'); } }, () => now);
  assert.equal(await broken.load(key()), undefined);
  const cache = createMemoryCache(80, broken);
  assert.deepEqual(await cache.refresh(key(), async () => snapshot(120)), snapshot(120));
});
