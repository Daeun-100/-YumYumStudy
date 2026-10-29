import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createHookRuntime } from './helpers/hooks.mjs';
const source = ts.transpileModule(readFileSync(new URL('../src/design/toast/useToastEnvironment.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function mount(os, { subscriptionsAvailable = true } = {}) {
  const hooks = createHookRuntime(), events = new Map(); let readerCalls = 0;
  const modules = {
    react: hooks.react,
    'react-native': { Platform: { OS: os }, Keyboard: { isVisible: () => false, addListener: () => ({ remove() {} }) }, AccessibilityInfo: {
      isReduceMotionEnabled: async () => false,
      isScreenReaderEnabled: async () => { readerCalls++; return true; },
      addEventListener: (name, callback) => { events.set(name, callback); return subscriptionsAvailable ? { remove: () => events.delete(name) } : undefined; },
    } },
    '../../hooks/useAppActive': { useAppActive: () => true }, '../../hooks/useBlockingOverlay': { useOverlaysBlocked: () => false },
  };
  const context = { exports: {}, require: name => { assert.ok(name in modules, name); return modules[name]; }, document: { activeElement: null, addEventListener() {}, removeEventListener() {} } };
  vm.runInNewContext(source, context);
  return { render: () => hooks.render(() => context.exports.useToastEnvironment()),
    flush: async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); },
    readerCalls: () => readerCalls, events, dispose: hooks.dispose };
}
test('web ignores RN Web constant screen-reader true and retains default toast timing', async () => {
  const app = mount('web'); app.render(); await app.flush(); const state = app.render();
  assert.equal(state.ready, true); assert.equal(state.screenReader, false); assert.equal(app.readerCalls(), 0);
  assert.equal(app.events.has('screenReaderChanged'), false); app.dispose();
});
test('native screen-reader activation still enables the accessibility timeout', async () => {
  const app = mount('ios'); app.render(); await app.flush(); assert.equal(app.render().screenReader, true);
  assert.equal(app.readerCalls(), 1); app.events.get('screenReaderChanged')(false);
  assert.equal(app.render().screenReader, false); app.dispose();
});
test('web cleanup tolerates unavailable event subscriptions', async () => {
  const app = mount('web', { subscriptionsAvailable: false }); app.render(); await app.flush();
  assert.equal(app.render().ready, true); assert.doesNotThrow(app.dispose);
});
