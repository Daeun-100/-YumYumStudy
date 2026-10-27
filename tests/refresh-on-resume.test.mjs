import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../src/hooks/useRefreshOnResume.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function mount(platform, enabled = true) {
  const webListeners = new Map();
  const nativeListeners = new Set();
  const cleanups = [];
  let calls = 0;
  const target = {
    visibilityState: 'visible',
    addEventListener: (event, callback) => webListeners.set(event, callback),
    removeEventListener: (event, callback) => {
      if (webListeners.get(event) === callback) webListeners.delete(event);
    },
  };
  const appState = {
    currentState: 'active',
    addEventListener: (_event, callback) => {
      nativeListeners.add(callback);
      return { remove: () => nativeListeners.delete(callback) };
    },
  };
  const context = {
    exports: {}, document: target, window: target,
    require: name => name === 'react'
      ? { useCallback: callback => callback, useEffect: effect => { cleanups.push(effect()); } }
      : { Platform: { OS: platform }, AppState: appState },
  };
  vm.runInNewContext(source, context);
  const refreshIfActive = context.exports.useRefreshOnResume(() => { calls++; }, enabled);
  return {
    calls: () => calls, refreshIfActive,
    web: (event, visibility) => { target.visibilityState = visibility; webListeners.get(event)?.(); },
    native: state => { appState.currentState = state; for (const callback of nativeListeners) callback(state); },
    cleanup: () => cleanups.forEach(fn => fn?.()),
    listenerCount: () => webListeners.size + nativeListeners.size,
  };
}

test('web: returning and online recovery refresh, hidden tab does not', () => {
  const hook = mount('web');
  assert.equal(hook.calls(), 0);
  hook.web('visibilitychange', 'hidden');
  hook.web('online', 'hidden');
  assert.equal(hook.calls(), 0);
  hook.web('visibilitychange', 'visible');
  assert.equal(hook.calls(), 1);
  hook.web('online', 'visible');
  assert.equal(hook.calls(), 2);
  hook.cleanup();
  assert.equal(hook.listenerCount(), 0);
  hook.web('visibilitychange', 'visible');
  assert.equal(hook.calls(), 2);
});

for (const platform of ['android', 'ios']) {
  test(`${platform}: background/inactive do not refresh, return to active does`, () => {
    const hook = mount(platform);
    hook.native('background');
    hook.refreshIfActive();
    hook.native('inactive');
    assert.equal(hook.calls(), 0);
    hook.native('active');
    assert.equal(hook.calls(), 1);
    hook.cleanup();
    assert.equal(hook.listenerCount(), 0);
    hook.native('active');
    assert.equal(hook.calls(), 1);
  });
}

test('disabled hook neither subscribes nor refreshes', () => {
  for (const platform of ['web', 'android', 'ios']) {
    const hook = mount(platform, false);
    hook.refreshIfActive();
    assert.equal(hook.calls(), 0);
    assert.equal(hook.listenerCount(), 0);
  }
});
