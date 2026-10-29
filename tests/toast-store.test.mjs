import test from 'node:test';
import assert from 'node:assert/strict';
import { createToastStore } from '../src/design/toast/store.ts';
function mount({ reducedMotion = true } = {}) {
  let now = 0, sequence = 0;
  const jobs = new Map();
  const store = createToastStore({ setTimer: (run, ms) => { const id = ++sequence; jobs.set(id, { run, at: now + ms }); return id; }, clearTimer: id => jobs.delete(id) });
  store.setScope('room:user');
  let env = { enabled: true, active: true, blocked: false, screenReader: false, reducedMotion };
  store.setEnvironment(env);
  const show = options => store.show(options, 'room:user');
  return { store, show, present: () => store.didPresent(store.read().active.id, 'room:user'), environment(patch) { env = { ...env, ...patch }; store.setEnvironment(env); },
    advance(ms) {
      const end = now + ms;
      for (;;) { const job = [...jobs].sort((a, b) => a[1].at - b[1].at)[0]; if (!job || job[1].at > end) break; now = job[1].at; jobs.delete(job[0]); job[1].run(); }
      now = end;
    },
  };
}
test('default auto dismissal starts when the host presents, not when enqueued', () => {
  const app = mount(), shown = [], dismissed = [];
  const id = app.show({ title: '공지', onShow: () => shown.push(id), onDismiss: reason => dismissed.push(reason) });
  app.advance(10000); assert.equal(app.store.read().active.id, id); assert.deepEqual(shown, []);
  app.present(); app.present(); assert.deepEqual(shown, [id]);
  app.advance(3999); assert.ok(app.store.read().active); app.advance(1);
  assert.equal(app.store.read().active, null); assert.deepEqual(dismissed, ['timeout']);
});
test('shared FIFO host displays one at a time and a queued item gets its full duration', () => {
  const app = mount(); const a = app.show({ title: '하나', durationMs: 2000 }), b = app.show({ title: '둘', durationMs: 2000 });
  app.present(); app.advance(2000); assert.equal(app.store.read().active.id, b);
  app.advance(4000); assert.equal(app.store.read().active.id, b);
  app.present(); app.advance(2000); assert.equal(app.store.read().active, null); assert.notEqual(a, b);
});
test('duplicate event keys share an active/queued item and suppress completed events', () => {
  const app = mount();
  const id = app.show({ id: 'one', title: '완료', dedupeKey: 'event:42' });
  assert.equal(app.show({ id: 'two', title: '완료', dedupeKey: 'event:42' }), id);
  app.present(); app.advance(4000);
  assert.equal(app.show({ title: '완료', dedupeKey: 'event:42' }), null);
  assert.ok(app.show({ title: '다른 이벤트', dedupeKey: 'event:43' }));
});
test('updating content keeps its original expiry and closed IDs cannot revive', () => {
  const app = mount(), id = app.show({ title: '저장 중' }); app.present(); app.advance(3000);
  assert.equal(app.store.update(id, { title: '저장 완료' }, 'room:user'), true);
  app.advance(1000); assert.equal(app.store.read().active, null);
  assert.equal(app.store.update(id, { title: '늦은 응답' }, 'room:user'), false);
});
test('modal and keyboard blocking holds new toasts without consuming their onShow', () => {
  const app = mount(); app.environment({ blocked: true }); let shows = 0;
  const id = app.show({ title: '안내', durationMs: 2000, onShow: () => shows++ });
  app.advance(10000); assert.equal(app.store.read().active, null); assert.equal(shows, 0);
  app.environment({ blocked: false }); assert.equal(app.store.read().active.id, id);
  app.present(); app.advance(1999); assert.equal(shows, 1); assert.ok(app.store.read().active);
  app.advance(1); assert.equal(app.store.read().active, null);
});
test('background clears active and pending, without restoring either on return', () => {
  const app = mount(), reasons = []; app.show({ title: '하나', onDismiss: reason => reasons.push(reason) }); app.present(); app.show({ title: '둘' });
  app.environment({ active: false }); assert.deepEqual(reasons, ['background']); assert.equal(app.store.read().pendingCount, 0);
  assert.equal(app.show({ title: '화면 밖의 늦은 응답' }), null);
  app.environment({ active: true }); app.advance(10000); assert.equal(app.store.read().active, null);
});
test('new user/room rejects callbacks bound to the old scope', () => {
  const app = mount(), id = app.show({ title: '이전 사용자' }); app.present(); app.store.setScope('room:other');
  assert.equal(app.show({ title: '이전 사용자의 늦은 응답' }), null);
  assert.equal(app.store.update(id, { title: '늦은 갱신' }, 'room:user'), false);
  assert.ok(app.store.show({ title: '새 사용자' }, 'room:other'));
});
test('custom phase content owns its duration while sharing position, queue and dedupe', () => {
  const app = mount(), id = app.show({ durationMs: null, render: () => null }); app.present(); app.advance(60000);
  assert.equal(app.store.read().active.id, id); app.store.dismiss(id, 'room:user'); assert.equal(app.store.read().active, null);
});
test('screen readers get at least ten seconds and queue size is bounded', () => {
  const app = mount(); app.environment({ screenReader: true }); app.show({ title: '짧은 안내', durationMs: 2000 }); app.present();
  app.advance(9999); assert.ok(app.store.read().active); app.advance(1); assert.equal(app.store.read().active, null);
  app.environment({ blocked: true }); for (let i = 0; i < 5; i++) assert.ok(app.show({ title: `대기 ${i}` }));
  assert.equal(app.show({ title: '대기열 초과' }), null); assert.equal(app.store.read().pendingCount, 5);
});
test('consumer callback exceptions and unmount cannot leave a running queue behind', () => {
  const app = mount(); app.show({ title: '안내', onShow: () => { throw Error('consumer'); }, onDismiss: () => { throw Error('consumer'); } });
  app.present(); app.store.dispose(); app.advance(10000); assert.equal(app.store.read().active, null); assert.equal(app.store.read().pendingCount, 0);
});

test('normal timeout starts a short exit before releasing the host to the next toast', () => {
  const app = mount({ reducedMotion: false }), ended = [];
  const first = app.show({ title: '공지', onDismiss: reason => ended.push(reason) });
  const next = app.show({ title: '다음 안내' }); app.present();
  app.advance(4000); assert.equal(app.store.read().active.id, first); assert.equal(app.store.read().active.closing, true);
  assert.deepEqual(ended, []); assert.equal(app.store.update(first, { title: '늦은 응답' }, 'room:user'), false);
  app.advance(199); assert.equal(app.store.read().active.id, first);
  app.advance(1); assert.equal(app.store.read().active.id, next); assert.deepEqual(ended, ['timeout']);
});
test('manual close animates once, without restarting when dismissed repeatedly', () => {
  const app = mount({ reducedMotion: false }), id = app.show({ title: '완료' }); app.present();
  app.store.dismiss(id, 'room:user'); app.advance(150); app.store.dismiss(id, 'room:user');
  app.advance(50); assert.equal(app.store.read().active, null);
});
test('background interrupts an exit immediately and does not restore the next toast', () => {
  const app = mount({ reducedMotion: false }); app.show({ title: '안내' }); app.present(); app.show({ title: '대기' });
  app.advance(4000); assert.equal(app.store.read().active.closing, true);
  app.environment({ active: false }); assert.equal(app.store.read().active, null);
  app.environment({ active: true }); app.advance(1000); assert.equal(app.store.read().active, null);
});
test('custom content already owning an exit is not delayed a second time', () => {
  const app = mount({ reducedMotion: false }), id = app.show({ durationMs: null, render: () => null }); app.present();
  app.store.dismiss(id, 'room:user'); assert.equal(app.store.read().active, null);
});
