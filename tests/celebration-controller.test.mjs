import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createHookRuntime } from './helpers/hooks.mjs';
import * as model from '../src/features/celebrations/model.ts';
import { getStudyDate } from '../src/lib/study-day.ts';
import { displayedSeconds } from '../src/features/study/presentation.ts';
const source = ts.transpileModule(readFileSync(new URL('../src/features/celebrations/AchievementCelebrations.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const epoch = Date.parse('2026-10-31T10:00:00+09:00'), date = '2026-10-31';
const day = studyDate => ({ studyDate, goalMinutes: 120, closedSeconds: 7200, runningSeconds: 0, attendance: 'present', isRestDay: false });
function mount({ live = true } = {}) {
  const runtime = createHookRuntime(), confirmed = deferred(), history = deferred(), leave = deferred();
  let now = epoch - 1, active = true, stored = null, reads = 0;
  const verified = { serverNow: new Date(epoch).toISOString(), data: { profile: { id: 'owner' }, day: day(date), activeSession: null } };
  const study = { canCelebrateLive: live, startupReady: true, busy: false, actionFailed: false, today: { serverNow: new Date(epoch - 1000).toISOString(), data: { profile: { id: 'owner' }, day: { ...day(date), closedSeconds: 0, runningSeconds: 7199 }, activeSession: { startedAt: new Date(epoch - 7200000).toISOString() } } }, confirmToday: () => confirmed.promise };
  const modules = {
    react: runtime.react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { StyleSheet: { create: value => value }, View: 'View' },
    '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async () => stored, setItem: async (_key, value) => { stored = value; } } },
    '../../components/IdentityProvider': { useIdentity: () => ({ uid: 'owner', loading: false, error: null }) },
    '../../components/StartupBoundary': { useStartupVisible: () => true },
    '../../data/study': { getHistory: () => history.promise },
    '../../data/leave': { getLeaveStatus: () => { reads++; return leave.promise; } },
    '../../lib/room': { studyRoomId: 0 }, '../../lib/study-day': { getStudyDate },
    '../study/StudyProvider': { useStudy: () => study }, '../study/study-clock': { useStudyNow: () => now },
    '../study/presentation': { displayedSeconds }, './model': model,
    './CelebrationToast': { CelebrationToast: 'Toast' },
    '../../design/toast': { ToastSlot: 'ToastSlot', useToastEnvironment: () => ({ ready: true, active, blocked: false }) },
  };
  const context = { exports: {}, require: name => { assert.ok(name in modules, name); return modules[name]; } };
  vm.runInNewContext(source, context);
  const render = () => runtime.render(() => context.exports.AchievementCelebrations());
  const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
  return { render, flush, study, confirmed, history, leave, verified, dispose: runtime.dispose,
    cross() { now = epoch; render(); const view = render(); view?.props.onShow?.(); return view; },
    queueGoal() { now = epoch; render(); return render(); },
    background() { active = false; render(); }, resume() { active = true; study.canCelebrateLive = false; render(); },
    reads: () => reads, stored: () => stored,
  };
}
const week = model.weekDates(date).slice(0, 6).map(day);
const reward = { data: { grants: [{ kind: 'reward', earningWeek: '2026-10-26', earnedAt: new Date(epoch).toISOString(), status: 'AVAILABLE' }] } };
test('live goal appears before server or history replies, then promotes in place', async () => {
  const app = mount(); assert.equal(app.render(), null); await app.flush();
  const first = app.cross(); assert.equal(first.props.children.props.notice.reward, false);
  assert.equal(app.reads(), 0); await app.flush(); assert.equal(app.stored(), date);
  app.history.resolve({ data: week }); await app.flush();
  assert.equal(app.render().props.children.props.notice.rewardPending, true);
  app.confirmed.resolve(app.verified); await app.flush();
  assert.equal(app.reads(), 1); assert.equal(app.render().props.children.props.notice.reward, false);
  app.leave.resolve(reward); await app.flush();
  const after = app.render(); assert.equal(after.props.children.props.notice.reward, true);
  assert.equal(after.props.children.key, first.props.children.key);
  app.dispose();
});
test('a failed leave read never suppresses the already visible goal', async () => {
  const app = mount(); app.render(); await app.flush(); assert.ok(app.cross());
  app.confirmed.resolve(app.verified); app.history.resolve({ data: week }); await app.flush();
  app.leave.reject(Error('offline')); await app.flush();
  const notice = app.render().props.children.props.notice;
  assert.equal(notice.reward, false); assert.equal(notice.rewardPending, false); app.dispose();
});
test('returning to app waits for server and guard reconciliation before celebrating', async () => {
  const app = mount({ live: false }); app.render(); await app.flush();
  assert.equal(app.cross(), null);
  app.confirmed.resolve(app.verified); await app.flush();
  assert.ok(app.render()); app.dispose();
});
test('a stale running timer on return cannot celebrate when confirmed time is short', async () => {
  const app = mount({ live: false }); app.render(); await app.flush(); assert.equal(app.cross(), null);
  app.confirmed.resolve({ ...app.verified, data: { ...app.verified.data, day: { ...day(date), closedSeconds: 7199 } } });
  await app.flush(); assert.equal(app.render(), null); assert.equal(app.stored(), null); app.dispose();
});
test('expired toast stays closed when the reward reply arrives later', async () => {
  const app = mount(); app.render(); await app.flush(); const view = app.cross();
  view.props.children.props.onDismiss(); assert.equal(app.render(), null);
  app.confirmed.resolve(app.verified); app.history.resolve({ data: week }); await app.flush();
  app.leave.resolve(reward); await app.flush(); assert.equal(app.render(), null); app.dispose();
});
test('backgrounding an already started toast consumes it and discards late responses', async () => {
  const app = mount(); app.render(); await app.flush(); assert.ok(app.cross()); app.background();
  app.confirmed.resolve(app.verified); app.history.resolve({ data: week }); app.leave.resolve(reward); await app.flush();
  app.resume(); await app.flush(); assert.equal(app.render(), null); app.dispose();
});

test('late history cannot re-enable reward waiting after the reward request failed', async () => {
  const app = mount(); app.render(); await app.flush(); assert.ok(app.cross());
  app.confirmed.resolve(app.verified); await app.flush();
  app.leave.reject(Error('offline')); await app.flush();
  assert.equal(app.render().props.children.props.notice.rewardPending, false);
  app.history.resolve({ data: week }); await app.flush();
  assert.equal(app.render().props.children.props.notice.rewardPending, false); app.dispose();
});

test('a celebration queued behind another toast is not marked seen until the host mounts it', async () => {
  const app = mount(); app.render(); await app.flush();
  const queued = app.queueGoal(); assert.ok(queued); assert.equal(app.stored(), null);
  queued.props.onShow(); await app.flush(); assert.equal(app.stored(), date); app.dispose();
});
