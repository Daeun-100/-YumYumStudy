import test from 'node:test';
import assert from 'node:assert/strict';
import { createResourceRefresh } from '../src/lib/resource-refresh.ts';
import { createStudyResourceDemand } from '../src/lib/study-resource-demand.ts';

const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function clock() {
  let now = 0;
  const jobs = new Map();
  return {
    schedule(callback, delay) { const id = {}; jobs.set(id, { callback, at: now + delay }); return id; },
    cancel(id) { jobs.delete(id); },
    delays() { return [...jobs.values()].map(job => job.at - now); },
    async advance(ms) {
      const end = now + ms;
      while (true) {
        const entry = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry || entry[1].at > end) break;
        now = entry[1].at; jobs.delete(entry[0]); entry[1].callback(); await flush();
      }
      now = end; await flush();
    },
  };
}

test('screen demand is reference counted, deduplicated and released once', () => {
  const demand = createStudyResourceDemand();
  const initial = demand.read();
  const home = demand.acquire(['today', 'room', 'room']);
  const focus = demand.acquire(['today', 'room']);
  assert.deepEqual(initial, { today: 0, room: 0 });
  assert.deepEqual(demand.read(), { today: 2, room: 2 });
  home(); home(); assert.deepEqual(demand.read(), { today: 1, room: 1 });
  focus(); assert.deepEqual(demand.read(), { today: 0, room: 0 });
});

test('healthy realtime polls after 60s, disconnected after 15s, starting at read completion', async () => {
  const time = clock(); let reads = 0;
  const loop = createResourceRefresh({ ...time, refresh: async () => { reads++; } });
  loop.setConnected(true); loop.setEnabled(true); await flush();
  assert.equal(reads, 1); assert.deepEqual(time.delays(), [60000]);
  await time.advance(59999); assert.equal(reads, 1);
  await time.advance(1); assert.equal(reads, 2);
  loop.setConnected(false); assert.deepEqual(time.delays(), [15000]);
  await time.advance(15000); assert.equal(reads, 3);
  loop.dispose(); assert.deepEqual(time.delays(), []);
});

test('hidden resources cancel timers, retain invalidation and revalidate once on return', async () => {
  const time = clock(); let reads = 0;
  const loop = createResourceRefresh({ ...time, refresh: async () => { reads++; } });
  await loop.request(true); await time.advance(120000); assert.equal(reads, 0);
  loop.setEnabled(true); await flush(); assert.equal(reads, 1);
  loop.setEnabled(false); await loop.request(true); await time.advance(120000);
  assert.equal(reads, 1); assert.equal(time.delays().length, 0);
  loop.setEnabled(true); loop.request(false); await flush(); assert.equal(reads, 2);
  loop.dispose();
});

test('a change during a slow read queues one trailing read; polling does not', async () => {
  const time = clock(); const first = deferred(); let reads = 0;
  const loop = createResourceRefresh({ ...time, refresh: async () => { if (++reads === 1) await first.promise; } });
  loop.setEnabled(true); await flush();
  loop.request(false); loop.request(false); assert.equal(reads, 1);
  loop.request(true); loop.request(true); first.resolve(); await flush();
  assert.equal(reads, 2); assert.equal(time.delays().length, 1);
  loop.dispose();
});

test('failed requests back off and repeated events cannot bypass the retry deadline', async () => {
  const time = clock(); let reads = 0, fail = true;
  const loop = createResourceRefresh({ ...time, random: () => .5, refresh: async () => { reads++; if (fail) throw Error('offline'); } });
  loop.setEnabled(true); await flush();
  for (const delay of [5000, 10000, 20000, 40000, 60000]) {
    assert.deepEqual(time.delays(), [delay]);
    const before = reads;
    for (let i = 0; i < 10; i++) await loop.request(true);
    assert.equal(reads, before);
    await time.advance(delay);
  }
  fail = false; loop.setConnected(true); await flush();
  assert.deepEqual(time.delays(), [60000]);
  loop.dispose();
});

test('no query starts after blur before its microtask, and disposal cancels trailing work', async () => {
  const time = clock(); let reads = 0;
  const first = deferred();
  const loop = createResourceRefresh({ ...time, refresh: async () => { reads++; await first.promise; } });
  loop.setEnabled(true); loop.setEnabled(false); await flush(); assert.equal(reads, 0);
  loop.setEnabled(true); await flush(); loop.request(true); loop.dispose(); first.resolve(); await flush();
  assert.equal(reads, 1); assert.deepEqual(time.delays(), []);
});

test('an explicit successful startup read avoids a duplicate first observation fetch', async () => {
  const time = clock(); let reads = 0;
  const loop = createResourceRefresh({ ...time, refresh: async () => { reads++; } });
  loop.markFresh(); loop.setConnected(true); loop.setEnabled(true); await flush();
  assert.equal(reads, 0); assert.deepEqual(time.delays(), [60000]);
  await time.advance(60000); assert.equal(reads, 1); loop.dispose();
});

test('one slow resource never blocks another resource or its retry policy', async () => {
  const time = clock(); const slow = deferred(); let rooms = 0;
  const today = createResourceRefresh({ ...time, refresh: () => slow.promise });
  const room = createResourceRefresh({ ...time, refresh: async () => { rooms++; } });
  today.setEnabled(true); room.setEnabled(true); await flush();
  await time.advance(30000); assert.equal(rooms, 3);
  today.dispose(); room.dispose(); slow.resolve(); await flush();
});
