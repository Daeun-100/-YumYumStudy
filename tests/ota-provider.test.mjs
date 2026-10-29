import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createHookRuntime } from './helpers/hooks.mjs';
import { createOtaController } from '../src/features/ota/controller.ts';

const source = ts.transpileModule(readFileSync(new URL('../src/features/ota/OtaUpdateProvider.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function mount({ platform = 'android', enabled = true, development = false, startupPending = false } = {}) {
  const runtime = createHookRuntime();
  const state = { checks: 0, downloads: 0, reloads: 0, prepares: 0, messages: [], path: '/profile', pending: startupPending, failCheck: false, prepare: true };
  let onResume;
  const study = { startupReady: true, today: { data: { activeSession: null } }, busy: false, actionFailed: false,
    prepareUpdateReload: async () => { state.prepares++; return state.prepare; } };
  const leave = { busy: false, actionFailed: false };
  const identity = { profile: { id: 'owner' }, loading: false };
  const room = { activeRoomOperations: 0, roomSwitching: false };
  const appState = { currentState: 'active', addEventListener: (_event, listener) => { onResume = listener; return { remove: () => { onResume = undefined; } }; } };
  const react = { ...runtime.react, createContext: value => ({ value, Provider: 'Provider' }) };
  const toast = { show: options => { state.messages.push(options.message); return 'toast'; } };
  const modules = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => typeof type === 'function' ? type(props) : { type, ...props }, jsxs: (type, props) => ({ type, ...props }) },
    'react-native': { Platform: { OS: platform }, AppState: appState, Keyboard: { isVisible: () => false }, StyleSheet: { create: value => value, absoluteFill: {} }, View: 'View' },
    'expo-updates': { isEnabled: enabled, useUpdates: () => ({ isUpdatePending: state.pending }),
      checkForUpdateAsync: async () => { state.checks++; if (state.failCheck) throw Error('offline'); return { isAvailable: true, isRollBackToEmbedded: false }; },
      fetchUpdateAsync: async () => { state.downloads++; return { isNew: true, isRollBackToEmbedded: false }; },
      reloadAsync: async () => { state.reloads++; } },
    'expo-router': { usePathname: () => state.path },
    '../study/StudyProvider': { useStudy: () => study }, '../leave/LeaveProvider': { useLeave: () => leave },
    '../../components/IdentityProvider': { useIdentity: () => identity }, '../../lib/room': room,
    '../../design/toast': { useToast: () => toast }, './controller': { createOtaController },
    './reload-gate': { beginUpdateReload: () => true, cancelUpdateReload: () => {}, updateReloadBlocked: () => false },
  };
  const context = { exports: {}, require: name => { assert.ok(name in modules, `unexpected import ${name}`); return modules[name]; }, __DEV__: development, Date };
  vm.runInNewContext(source, context);
  return { state, study, leave, room,
    render: () => runtime.render(() => context.exports.OtaUpdateProvider({ children: 'screen' })),
    flush: async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); },
    resume: () => onResume?.('active'), dispose: () => runtime.dispose(),
  };
}

test('startup and resume download quietly without banners, toasts or automatic reload', async () => {
  const app = mount(); app.render(); await app.flush();
  const ui = app.render(); assert.equal(ui.value.pending, true);
  assert.equal(ui.children[0], 'screen'); assert.equal(ui.children[1], false);
  assert.equal(app.state.downloads, 1); assert.equal(app.state.reloads, 0);
  assert.deepEqual(app.state.messages, []);
  app.resume(); await app.flush(); assert.equal(app.state.reloads, 0);
  app.dispose();
});

test('the profile action explicitly applies a pending update and blocks duplicate clicks', async () => {
  const app = mount(); app.render(); await app.flush();
  const api = app.render().value; await api.apply(); await api.apply();
  assert.equal(app.state.prepares, 1); assert.equal(app.state.reloads, 1);
  assert.equal(app.render().value.phase, 'applying'); app.dispose();
});

test('clicking while studying or saving shows shared toast feedback without applying', async () => {
  const app = mount(); app.render(); await app.flush();
  app.study.today.data.activeSession = { id: 'running' };
  await app.render().value.apply();
  assert.equal(app.state.messages.at(-1), '공부를 마친 뒤 적용해 주세요.');
  app.study.today.data.activeSession = null; app.leave.busy = true;
  await app.render().value.apply();
  assert.equal(app.state.messages.at(-1), '저장이 끝난 뒤 다시 눌러 주세요.');
  assert.equal(app.state.reloads, 0); assert.equal(app.state.prepares, 0); app.dispose();
});

test('changing route prevents an old profile click from reloading an editing screen', async () => {
  const app = mount(); app.render(); await app.flush();
  const oldAction = app.render().value.apply; app.state.path = '/profile-edit'; app.render();
  await oldAction(); assert.equal(app.state.reloads, 0); app.dispose();
});

test('built-in startup downloads also stay pending until a click', async () => {
  const app = mount({ startupPending: true }); app.render(); await app.flush();
  assert.equal(app.render().value.pending, true); assert.equal(app.state.reloads, 0);
  assert.deepEqual(app.state.messages, []); app.dispose();
});

for (const options of [{ platform: 'web' }, { enabled: false }, { development: true }]) {
  test(`unsupported runtime has no native OTA operations: ${JSON.stringify(options)}`, async () => {
    const app = mount(options); const ui = app.render(); await app.flush();
    assert.equal(ui.value.enabled, false); assert.equal(app.state.checks, 0); app.dispose();
  });
}

test('failed automatic checks stay quiet, while a failed manual check shows a toast', async () => {
  const app = mount(); app.state.failCheck = true; app.render(); await app.flush();
  assert.deepEqual(app.state.messages, []);
  await app.render().value.check();
  assert.equal(app.state.messages.at(-1), '업데이트를 확인하지 못했어요. 다시 시도해 주세요.');
  assert.equal(app.state.reloads, 0); app.dispose();
});
