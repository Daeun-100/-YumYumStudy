import test from 'node:test';
import assert from 'node:assert/strict';
import { createRewardTiming } from '../src/features/celebrations/reward-timing.ts';

function mount() {
  let now = 0, next = 0;
  const timers = new Map(), events = [];
  const gate = createRewardTiming({ now: () => now,
    setTimer: (run, ms) => { const id = ++next; timers.set(id, { at: now + ms, run }); return id; },
    clearTimer: id => timers.delete(id), onCollect: () => events.push(['collect', now]), onExpire: () => events.push(['expire', now]),
  });
  return { gate, events, advance(ms) {
    const end = now + ms;
    for (;;) {
      const job = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!job || job[1].at > end) break;
      now = job[1].at; timers.delete(job[0]); job[1].run();
    }
    now = end;
  } };
}
test('fast reward waits for the stamp and original hold, without replaying it', () => {
  const app = mount(); app.gate.update(true, false); app.advance(5000);
  assert.deepEqual(app.events, []);
  app.gate.stamped(); app.advance(799); assert.deepEqual(app.events, []);
  app.advance(1); assert.deepEqual(app.events, [['collect', 5800]]);
  app.gate.update(true, false); app.gate.stamped(); app.advance(1000);
  assert.equal(app.events.length, 1);
  app.gate.rewardFinished(); app.advance(1999); assert.equal(app.events.length, 1);
  app.advance(1); assert.deepEqual(app.events.at(-1), ['expire', 8800]);
});
test('a delayed reward promotes the same notice as soon as confirmed', () => {
  const app = mount(); app.gate.update(false, true); app.gate.stamped(); app.advance(3000);
  assert.deepEqual(app.events, []); app.gate.update(true, false);
  assert.deepEqual(app.events, [['collect', 3000]]);
});
test('sixth-day candidate gets at most two extra seconds, then cannot revive', () => {
  const app = mount(); app.gate.update(false, true); app.gate.stamped(); app.advance(5999);
  assert.deepEqual(app.events, []); app.advance(1);
  assert.deepEqual(app.events, [['expire', 6000]]);
  app.gate.update(true, false); assert.equal(app.events.length, 1);
});
test('confirmation during extra wait still promotes', () => {
  const app = mount(); app.gate.update(false, true); app.gate.stamped(); app.advance(5000);
  app.gate.update(true, false); assert.deepEqual(app.events, [['collect', 5000]]);
});
test('ordinary goal expires after four seconds without waiting on the network', () => {
  const app = mount(); app.gate.update(false, false); app.gate.stamped(); app.advance(4000);
  assert.deepEqual(app.events, [['expire', 4000]]);
  app.gate.update(true, false); assert.equal(app.events.length, 1);
});
test('failed reward removes extension, preserving the normal goal lifetime', () => {
  const app = mount(); app.gate.update(false, true); app.gate.stamped(); app.advance(2000);
  app.gate.update(false, false); app.advance(2000);
  assert.deepEqual(app.events, [['expire', 4000]]);
});
test('background disposal cancels collection and expiry', () => {
  const app = mount(); app.gate.update(true, false); app.gate.stamped(); app.advance(100);
  app.gate.dispose(); app.advance(10000); app.gate.update(true, false);
  assert.deepEqual(app.events, []);
});
