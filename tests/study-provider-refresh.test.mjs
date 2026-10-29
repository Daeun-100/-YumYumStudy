import { createHookRuntime } from './helpers/hooks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createStudyClock } from '../src/lib/study-clock.ts';
import { createSharedRequest } from '../src/lib/shared-request.ts';
import { createResourceRefresh } from '../src/lib/resource-refresh.ts';
import { createStudyResourceDemand } from '../src/lib/study-resource-demand.ts';

const source = ts.transpileModule(readFileSync(new URL('../src/features/study/StudyProvider.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
const snapshot = active => ({ serverNow: '2026-10-27T00:00:00Z', data: {
  profile: { id: 'owner' }, day: { studyDate: '2026-10-27', closedSeconds: 0, runningSeconds: 0 },
  activeSession: active ? { id: active, startedAt: '2026-10-27T00:00:00Z', endedAt: null } : null,
} });

function mount({ resources = ['today', 'room'] } = {}) {
  const runtime = createHookRuntime();
  const timers = new Map();
  const intervals = new Map();
  let onChange, onConnection;
  let active = true, now = 0;
  const demand = createStudyResourceDemand();
  let releaseDemand = demand.acquire(resources);
  const timeout = (callback, ms = 0) => { const id = {}; timers.set(id, { callback, ms, at: now + ms }); return id; };
  const clear = id => timers.delete(id);
  const identity = { profile: { id: 'owner' }, loading: false, error: null, updateProfile: profile => { identity.profile = profile; } };
  const calls = { recover: 0, today: 0, room: 0, start: 0 };
  const data = {
    resumePendingStudyStart: async () => { calls.recover++; return null; },
    getToday: async () => { calls.today++; return snapshot(null); },
    getRoom: async () => { calls.room++; return { serverNow: '2026-10-27T00:00:00Z', data: [] }; },
    startStudy: async () => { calls.start++; return { serverNow: '2026-10-27T00:00:00Z', data: { id: 'new-session', startedAt: '2026-10-27T00:00:00Z', endedAt: null } }; },
    subscribeStudyChanges: (callback, state) => { onChange = callback; onConnection = state; state('connecting'); return () => { onChange = null; onConnection = null; }; },
  };
  const react = runtime.react;
  const modules = {
    react, 'react/jsx-runtime': { jsx: (_type, props) => ['ClockProvider', 'ResourceProvider'].includes(_type) ? props.children : props.value },
    'react-native': { Platform: { OS: 'ios' }, AppState: { currentState: 'active' } },
    '../../lib/shared-request': { createSharedRequest },
    '../../lib/study-clock': { createStudyClock },
    './study-clock': { StudyClockContext: { Provider: 'ClockProvider' } },
    '../../data/query-cache': { invalidateRecordQueries: () => {} },
    '../../lib/performance': { measure: (_name, run) => run(), finishTiming: () => () => {} },
    '../../lib/with-timeout': { withTimeout: promise => promise },
    '../allowed-apps/native': { studyGuard: null },
    '../../lib/room': { studyRoomId: 1, withRoomOperation: run => run() },
    '../../hooks/useRefreshOnResume': { isAppActive: () => active },
    '../../hooks/useAppActive': { useAppActive: () => active },
    '../../lib/study-resource-demand': { createStudyResourceDemand: () => demand },
    './study-resources': { StudyResourceContext: { Provider: 'ResourceProvider' } },
    '../../data/study': data,
    '../../components/IdentityProvider': { useIdentity: () => identity },
    './android-guard': { reconcileAndroidGuard: async value => ({ snapshot: value }) },
    './presentation': { displayedSeconds: () => 0 },
    '../../lib/clock': { createServerClock: () => () => 0 },
    '../../lib/study-day': { getStudyDate: () => '2026-10-27' },
    '../../lib/contracts': { toStudyError: error => error },
    './pending-action': { actionConfirmed: () => true },
    './timer-mode-core': {}, './guard-core': {},
  };
  const hookModules = {
    react,
    '../lib/resource-refresh': { createResourceRefresh: options => createResourceRefresh({ ...options, schedule: timeout, cancel: clear, random: () => .5 }) },
    './useAppActive': { useAppActive: () => active },
    './useRefreshOnResume': { isAppActive: () => active, useRefreshOnResume: callback => callback },
  };
  const hookContext = { exports: {}, require: name => hookModules[name] };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/hooks/useResourceRefresh.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, hookContext);
  modules['../../hooks/useResourceRefresh'] = hookContext.exports;
  const context = { exports: {}, require: name => {
    assert.ok(name in modules, `unexpected import ${name}`);
    return modules[name];
  }, setTimeout: timeout, clearTimeout: clear, setInterval: (callback, ms) => { const id = {}; intervals.set(id, { callback, ms }); return id; }, clearInterval: id => intervals.delete(id) };
  vm.runInNewContext(source, context);
  const render = () => runtime.render(() => context.exports.StudyProvider({ children: null }));
  const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
  return { render, calls, data, identity, change: (owner = 'friend') => onChange?.(owner),
    connection: value => onConnection?.(value),
    setResources(resources) { releaseDemand(); releaseDemand = demand.acquire(resources); },
    setActive(value) { active = value; },
    delays: () => [...timers.values()].filter(value => value.ms > 0).map(value => value.at - now),
    async advance(ms) {
      const end = now + ms;
      while (true) {
        const job = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!job || job[1].at > end) break;
        now = job[1].at; timers.delete(job[0]); job[1].callback(); await flush();
      }
      now = end; await flush();
    },
    runTimers() { for (const [id, job] of [...timers]) if (job.ms === 0) { timers.delete(id); job.callback(); } },
  };

}

test('startup recovers once before one initial snapshot read, and concurrent retries share it', async () => {
  const app = mount();
  const recovery = deferred();
  app.data.resumePendingStudyStart = async () => { app.calls.recover++; await recovery.promise; return null; };
  const state = app.render();
  app.runTimers();
  const first = state.retryStartup();
  assert.equal(state.retryStartup(), first);
  assert.equal(app.calls.recover, 1);
  assert.equal(app.calls.today, 0);
  recovery.resolve();
  await first;
  assert.equal(app.calls.today, 1);
  assert.equal(app.calls.room, 1);
  assert.equal(app.render().startupReady, true);
});

test('double start shares the action lock; an older read cannot overwrite acknowledged start', async () => {
  const app = mount();
  let state = app.render();
  await state.retryStartup();
  state = app.render();
  const old = deferred(), fresh = deferred(), started = deferred();
  let reads = 0;
  app.data.getToday = () => ++reads === 1 ? old.promise : fresh.promise;
  app.data.startStudy = async () => { app.calls.start++; return started.promise; };
  const before = state.refresh();
  await Promise.resolve();
  const action = state.toggle();
  assert.equal(await state.toggle(), false);
  started.resolve({ serverNow: '2026-10-27T00:00:01Z', data: { id: 'new-session', startedAt: '2026-10-27T00:00:01Z', endedAt: null } });
  assert.equal(await action, true);
  assert.equal(app.calls.start, 1);
  old.resolve(snapshot(null));
  await before;
  state = app.render();
  assert.equal(state.today.data.activeSession.id, 'new-session');
  assert.equal(reads, 2);
  fresh.resolve(snapshot('new-session'));
  await state.refresh();
  assert.equal(app.render().today.data.activeSession.id, 'new-session');
});

test('slow friends do not delay live owner startup or allow duplicate timer starts', async () => {
  const app = mount();
  const friends = deferred();
  app.data.getRoom = () => friends.promise;
  let state = app.render();
  await state.retryStartup();
  state = app.render();
  assert.equal(state.startupReady, true);
  assert.ok(state.today);
  assert.equal(state.room, null);
  assert.equal(state.roomLoading, true);
  const start = state.toggle();
  assert.equal(await state.toggle(), false);
  assert.equal(await start, true);
  assert.equal(app.calls.start, 1);
  friends.resolve({ serverNow: '2026-10-27T00:00:00Z', data: [] });
  await app.render().refreshRoom();
});

test('friend failure is isolated and retries without re-fetching owner history', async () => {
  const app = mount();
  app.data.getRoom = async () => { throw Error('friends offline'); };
  let state = app.render();
  await state.retryStartup();
  state = app.render();
  assert.equal(state.startupReady, true);
  assert.ok(state.today);
  assert.equal(state.error, null);
  assert.equal(state.roomError, 'friends offline');
  const reads = app.calls.today;
  app.data.getRoom = async () => ({ serverNow: '2026-10-27T00:00:00Z', data: [] });
  await state.refreshRoom();
  state = app.render();
  assert.equal(app.calls.today, reads);
  assert.equal(state.roomError, null);
  assert.ok(state.room);
});

test('owner failure never unlocks a timer using friends or cached data', async () => {
  const app = mount();
  app.data.getToday = async () => { throw Error('owner offline'); };
  let state = app.render();
  await state.retryStartup();
  state = app.render();
  assert.equal(state.today, null);
  assert.equal(await state.toggle(), false);
  assert.equal(app.calls.start, 0);
});

test('friend snapshot from before a start cannot replace the post-start friend snapshot', async () => {
  const app = mount();
  const old = deferred(), fresh = deferred();
  let rooms = 0;
  app.data.getRoom = () => ++rooms === 1 ? old.promise : fresh.promise;
  let state = app.render();
  await state.retryStartup();
  state = app.render();
  await state.toggle();
  fresh.resolve({ serverNow: '2026-10-27T00:00:01Z', data: [{ profile: { id: 'friend' }, marker: 'fresh' }] });
  await app.render().refreshRoom();
  old.resolve({ serverNow: '2026-10-27T00:00:00Z', data: [{ profile: { id: 'friend' }, marker: 'old' }] });
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(app.render().room.data[0].marker, 'fresh');
});


test('friend event refreshes during an owner start without waiting for its response', async () => {
  const app = mount();
  await app.render().retryStartup();
  let state = app.render();
  const start = deferred();
  app.data.startStudy = () => start.promise;
  const toggling = state.toggle();
  const ownerReads = app.calls.today;
  const roomReads = app.calls.room;
  app.change();
  await app.render().refreshRoom();
  assert.ok(app.calls.room > roomReads);
  assert.equal(app.calls.today, ownerReads);
  start.resolve({ serverNow: '2026-10-27T00:00:01Z', data: { id: 'started', startedAt: '2026-10-27T00:00:01Z', endedAt: null } });
  assert.equal(await toggling, true);
});

test('friend events during a read queue a fresh snapshot instead of losing the change', async () => {
  const app = mount();
  await app.render().retryStartup();
  app.render();
  const old = deferred();
  let reads = 0;
  app.data.getRoom = () => ++reads === 1 ? old.promise : Promise.resolve({ serverNow: '2026-10-27T00:00:02Z', data: [{ profile: { id: 'friend' }, marker: 'joined-and-started' }] });
  app.change();
  await Promise.resolve();
  app.change();
  old.resolve({ serverNow: '2026-10-27T00:00:01Z', data: [] });
  await app.render().refreshRoom();
  await app.advance(0);
  assert.equal(reads, 2);
  assert.equal(app.render().room.data[0].marker, 'joined-and-started');
});

test('missed friend events recover through the disconnected friend-only poll', async () => {
  const app = mount();
  await app.render().retryStartup();
  app.render();
  const ownerReads = app.calls.today;
  app.data.getRoom = async () => ({ serverNow: '2026-10-27T00:00:10Z', data: [{ profile: { id: 'friend' }, marker: 'polled' }] });
  await app.advance(15000);
  await app.render().refreshRoom();
  assert.equal(app.calls.today, ownerReads);
  assert.equal(app.render().room.data[0].marker, 'polled');
});

test('room refresh carries remote skin changes into the authenticated profile', async () => {
  const app = mount();
  await app.render().retryStartup();
  const changed = { id: 'owner', displayName: '친구', character: 'bunny', activeSkinId: 'bunny-toothache', skinUpdatedAt: '2026-10-28T00:00:00Z' };
  app.data.getRoom = async () => ({ serverNow: '2026-10-28T00:00:00Z', data: [{ profile: changed }] });
  await app.render().refreshRoom();
  app.render();
  assert.equal(app.identity.profile.activeSkinId, 'bunny-toothache');
  assert.equal(app.identity.profile.character, 'bunny');
});


test('today-only observation never starts a room query, and hidden screens stop both polls', async () => {
  const app = mount({ resources: ['today'] });
  await app.render().retryStartup(); app.render();
  assert.equal(app.calls.room, 0);
  const before = app.calls.today;
  await app.advance(60000); assert.equal(app.calls.today, before + 1); assert.equal(app.calls.room, 0);
  app.setActive(false); app.render(); const hidden = app.calls.today;
  await app.advance(120000); assert.equal(app.calls.today, hidden); assert.equal(app.calls.room, 0);
  app.setActive(true); app.render(); await app.advance(0); assert.equal(app.calls.today, hidden + 1);
});

test('healthy friend observation uses 60 seconds and only owner events invalidate today', async () => {
  const app = mount(); await app.render().retryStartup(); app.render();
  app.connection('connected'); app.render(); await app.advance(0);
  const rooms = app.calls.room, owner = app.calls.today;
  await app.advance(15000); assert.equal(app.calls.room, rooms);
  app.change('friend'); await app.advance(0); assert.equal(app.calls.today, owner);
  app.change('owner'); await app.advance(0); assert.equal(app.calls.today, owner + 1);
  app.setResources([]); app.render(); const counts = { ...app.calls };
  await app.advance(120000); assert.deepEqual(app.calls, counts);
});

test('mandatory startup and explicit reads still run without screen subscribers', async () => {
  const app = mount({ resources: [] }); await app.render().retryStartup(); app.render();
  assert.equal(app.calls.recover, 1); assert.equal(app.calls.today, 1); assert.equal(app.calls.room, 0);
  await app.advance(120000); assert.equal(app.calls.today, 1);
  await app.render().refresh(); assert.equal(app.calls.today, 2); assert.equal(app.calls.room, 0);
});
