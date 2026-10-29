import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createHookRuntime } from './helpers/hooks.mjs';
import { createResourceRefresh } from '../src/lib/resource-refresh.ts';
import { createSharedRequest } from '../src/lib/shared-request.ts';
import { getStudyDate } from '../src/lib/study-day.ts';
import { decodePostit, mergePostit } from '../src/features/postits/model.ts';

const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const note = { id: 'n', room_id: 1, author: '친구', text: '같이 공부', color: '#F9E8A0', x: .3, y: .7, study_date: '2026-10-29', deleted_at: null };
function mount() {
  const runtime = createHookRuntime(); const jobs = new Map();
  let active = true, focused = true, uid = 'owner', broadcast, status;
  let reads = 0, removals = 0;
  let now = Date.parse('2026-10-29T04:00:00Z');
  const rpc = { load: async () => ({ data: { date: getStudyDate(now), notes: [note] }, error: null }) };
  const channel = { on: (_kind, _filter, callback) => { broadcast = callback; return channel; }, subscribe: callback => { status = callback; return channel; } };
  const client = { rpc: async () => { reads++; return rpc.load(); }, realtime: { setAuth: async () => {} }, channel: () => channel, removeChannel: async () => { removals++; } };
  const load = (file, modules) => {
    const context = { exports: {}, require: name => { assert.ok(name in modules, `unexpected import ${name}`); return modules[name]; } };
    vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
    return context.exports;
  };
  const resource = load('../src/hooks/useResourceRefresh.ts', {
    react: runtime.react,
    '../lib/resource-refresh': { createResourceRefresh: options => createResourceRefresh({ ...options, random: () => .5, schedule: (callback, delay) => { const id = {}; jobs.set(id, { callback, delay }); return id; }, cancel: id => jobs.delete(id) }) },
    './useAppActive': { useAppActive: () => active },
    './useRefreshOnResume': { isAppActive: () => active, useRefreshOnResume: callback => callback },
  });
  const { usePostits } = load('../src/features/postits/usePostits.ts', {
    react: runtime.react, 'expo-router': { useIsFocused: () => focused },
    '../../lib/performance': { measure: (_name, run) => run() },
    '../../lib/supabase': { getSupabase: () => client },
    '../../lib/room': { studyRoomId: 1, withRoomOperation: run => run() },
    '../../lib/shared-request': { createSharedRequest },
    '../../lib/with-timeout': { withTimeout: promise => promise },
    '../../components/IdentityProvider': { useIdentity: () => ({ uid, profile: { id: uid } }) },
    '../../hooks/useResourceRefresh': resource,
    '../../hooks/useAppActive': { useAppActive: () => active },
    '../../lib/study-day': { getStudyDate },
    '../study/useScreenNow': { useScreenNow: () => now },
    './model': { decodePostit, mergePostit },
  });
  return { rpc, render: () => runtime.render(usePostits), reads: () => reads, removals: () => removals,
    message: payload => broadcast?.({ payload }), status: value => status?.(value),
    setActive(value) { active = value; }, setFocused(value) { focused = value; }, setUid(value) { uid = value; }, setNow(value) { now = value; },
    delays: () => [...jobs.values()].map(job => job.delay),
    async next() { const entry = [...jobs][0]; assert.ok(entry); jobs.delete(entry[0]); entry[1].callback(); await flush(); },
  };
}

test('postit requests merge broadcasts received during a snapshot, preserving tombstones', async () => {
  const app = mount(); const pending = deferred(); app.rpc.load = () => pending.promise;
  app.render(); await flush();
  app.message({ ...note, deleted_at: '2026-10-29T04:00:01Z' });
  pending.resolve({ data: { date: note.study_date, notes: [note] }, error: null }); await flush();
  assert.equal(app.render().notes.length, 0);
  app.message(note); assert.equal(app.render().notes.length, 0);
});

test('blur and background cancel observation; an old response cannot replace a new account', async () => {
  const app = mount(); app.render(); await flush(); assert.equal(app.render().notes.length, 1);
  app.setFocused(false); app.render(); await flush();
  assert.equal(app.delays().length, 0); assert.ok(app.removals() > 0);
  const before = app.reads(); await app.render().refresh(); assert.equal(app.reads(), before);
  app.setFocused(true); const old = deferred(); app.rpc.load = () => old.promise;
  app.render(); await flush();
  app.setUid('other'); const fresh = deferred(); app.rpc.load = () => fresh.promise;
  assert.equal(app.render().notes.length, 0); await flush();
  fresh.resolve({ data: { date: note.study_date, notes: [{ ...note, id: 'other-note' }] }, error: null }); await flush();
  old.resolve({ data: { date: note.study_date, notes: [note] }, error: null }); await flush();
  assert.equal(app.render().notes[0].id, 'other-note');
  app.setActive(false); app.render(); await flush(); assert.equal(app.delays().length, 0);
});

test('postits use disconnected/connected intervals and propagate read failure to backoff', async () => {
  const app = mount(); app.render(); await flush(); app.render();
  assert.deepEqual(app.delays(), [15000]);
  app.status('SUBSCRIBED'); app.render(); await flush(); assert.deepEqual(app.delays(), [60000]);
  app.rpc.load = async () => ({ data: null, error: Error('offline') });
  await app.next(); assert.deepEqual(app.delays(), [5000]); assert.ok(app.render().error);
  app.rpc.load = async () => ({ data: { date: note.study_date, notes: [note] }, error: null });
  await app.next(); assert.equal(app.render().error, null); assert.deepEqual(app.delays(), [60000]);
});

test('the 6am boundary invalidates postits without waiting for the next fallback deadline', async () => {
  const app = mount(); app.setNow(Date.parse('2026-10-28T20:59:59Z'));
  app.rpc.load = async () => ({ data: { date: '2026-10-28', notes: [] }, error: null });
  app.render(); await flush(); app.render(); const before = app.reads();
  app.setNow(Date.parse('2026-10-28T21:00:00Z'));
  app.rpc.load = async () => ({ data: { date: '2026-10-29', notes: [note] }, error: null });
  app.render(); await flush(); assert.ok(app.reads() > before); assert.equal(app.render().notes[0].id, 'n');
});
