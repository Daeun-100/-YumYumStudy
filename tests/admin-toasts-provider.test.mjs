import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createHookRuntime } from './helpers/hooks.mjs';
import * as model from '../src/features/admin-toasts/model.ts';
import { createToastHistory } from '../src/features/admin-toasts/storage.ts';
const id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const transpile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const source = transpile('../src/features/admin-toasts/AdminToasts.tsx') + '\nexports.AdminToasts = AdminToasts; exports.CampaignToast = CampaignToast;';
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function mount() {
  const hooks = createHookRuntime(), stored = new Map(), reports = [], registrations = [], timers = new Set();
  let now = 1000, snapshot;
  const row = { id, schema_version: 1, kind: 'update_ready', room_id: 1, starts_at: new Date(Date.now() - 1000).toISOString(), expires_at: new Date(Date.now() + 60000).toISOString(), platforms: ['android'], app_variant: 'production', min_capability_version: 1, revision: 1, payload: { updateId: id, groupId: id, channel: 'production', runtimeVersion: 'r' } };
  snapshot = { campaigns: [row], serverNow: Date.now(), observedAt: now };
  const identity = { uid: 'user', profile: {}, loading: false }, study = { startupReady: true, today: { data: {} } }, leave = {}, room = { studyRoomId: 1, isTestBuild: false, activeRoomOperations: 0 };
  const environment = { ready: true, active: true, blocked: false };
  const toast = { environment, show: options => { registrations.push(options); return options.id; }, update: () => {}, dismiss: () => {} };
  const storage = { getItem: async k => stored.get(k) ?? null, setItem: async (k, v) => stored.set(k, v) };
  const destination = { open: async () => {}, cancel: () => {} };
  const ota = { target: { enabled: true, pending: true, downloadedId: id, runningId: 'old', channel: 'production', runtime: 'r' } };
  const modules = {
    react: hooks.react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { Platform: { OS: 'android' } }, 'expo-crypto': { randomUUID: () => id },
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    '../../components/IdentityProvider': { useIdentity: () => identity }, '../../components/StartupBoundary': { useStartupVisible: () => true },
    '../../design/toast': { useToast: () => toast }, '../../lib/room': room,
    '../../lib/supabase': { getSupabase: () => ({ rpc: async (name, input) => { reports.push({ name, input }); return {}; } }) },
    '../study/StudyProvider': { useStudy: () => study }, '../leave/LeaveProvider': { useLeave: () => leave },
    '../ota/OtaUpdateProvider': { useOtaUpdate: () => ota }, '../ota/reload-gate': { isUpdateReloading: () => false },
    './model': model, './storage': { createToastHistory }, './useCampaigns': { useCampaigns: () => snapshot },
    './UpdateToast': { UpdateToastAction: 'UpdateToast' }, './UpdateDestination': { useUpdateDestination: () => destination, UpdateDestinationProvider: 'Provider' },
  };
  const context = { exports: {}, require: name => { assert.ok(name in modules, name); return modules[name]; },
    performance: { now: () => now }, console, setTimeout, clearTimeout, setInterval: fn => { timers.add(fn); return fn; }, clearInterval: fn => timers.delete(fn) };
  vm.runInNewContext(source, context);
  return { identity, study, environment, ota, reports, registrations, row, context, hooks, toast,
    render: () => hooks.render(() => context.exports.AdminToasts()), flush, dispose: hooks.dispose,
    changeSnapshot: value => { snapshot = value; }, advance: ms => { now += ms; timers.forEach(fn => fn()); },
  };
}
test('admin update waits while studying or blocked, resumes, and does not repeat after explicit completion', async () => {
  const app = mount(); app.study.today.data.activeSession = {};
  app.render(); await app.flush(); assert.equal(app.render(), null);
  app.study.today.data.activeSession = null; const visible = app.render(); assert.equal(visible.props.campaign.id, id);
  app.environment.blocked = true; assert.equal(app.render(), null);
  app.environment.blocked = false; assert.equal(app.render().props.campaign.id, id);
  await visible.props.onComplete('close'); visible.props.onFinish(); assert.equal(app.render(), null);
  assert.ok(app.reports.some(r => r.input.p_event === 'close')); app.dispose();
});
test('remote removal, stale config, applied OTA and a different target all hide without completing', async () => {
  const app = mount(); app.render(); await app.flush(); assert.ok(app.render());
  app.ota.target.runningId = id; assert.equal(app.render(), null);
  app.ota.target.runningId = 'old'; assert.ok(app.render());
  app.ota.target.downloadedId = 'different'; assert.equal(app.render(), null);
  app.ota.target.downloadedId = id; assert.ok(app.render());
  app.advance(91000); assert.equal(app.render(), null); assert.equal(app.reports.length, 0);
  app.changeSnapshot({ campaigns: [], serverNow: Date.now(), observedAt: 92000 }); assert.equal(app.render(), null); app.dispose();
});
test('callbacks from a previous user cannot report receipts into the current user', async () => {
  const app = mount(); app.render(); await app.flush(); const old = app.render();
  app.identity.uid = 'other'; app.render(); await app.flush();
  await old.props.onComplete('close'); assert.equal(app.reports.length, 0); app.dispose();
});
test('registration uses shared host and indefinite update lifetime', () => {
  const app = mount(); let retry, finished = 0;
  app.context.setTimeout = fn => { retry = fn; return 1; }; app.context.clearTimeout = () => {};
  const props = { campaign: app.row, onShown() {}, onComplete: async () => {}, onFinish: () => finished++ };
  app.hooks.render(() => app.context.exports.CampaignToast(props));
  const options = app.registrations[0]; assert.equal(options.durationMs, null); assert.equal(options.rememberCompleted, false);
  options.onDismiss('background'); assert.equal(finished, 1);
  app.dispose(); assert.equal(retry, undefined);
});

test('a full common queue retries without recording display or completion', () => {
  const app = mount(); let retry, accepted = false, shown = 0, completed = 0;
  app.context.setTimeout = fn => { retry = fn; return 1; }; app.context.clearTimeout = () => {};
  app.toast.show = options => accepted ? options.id : null;
  const props = { campaign: app.row, onShown: () => shown++, onComplete: async () => completed++, onFinish() {} };
  app.hooks.render(() => app.context.exports.CampaignToast(props));
  assert.equal(shown, 0); assert.equal(completed, 0); assert.ok(retry);
  accepted = true; retry(); app.hooks.render(() => app.context.exports.CampaignToast(props));
  assert.equal(shown, 0); assert.equal(completed, 0); app.dispose();
});
