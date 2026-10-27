import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, modules) {
  const context = { exports: {}, require(name) { assert.ok(name in modules, `unexpected import ${name}`); return modules[name]; } };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
  return context.exports;
}

test('covered screens disable clock subscriptions and resume with their requested resolution', () => {
  let focused = true;
  const calls = [];
  const { useScreenNow } = load('../src/features/study/useScreenNow.ts', {
    'expo-router': { useIsFocused: () => focused },
    './study-clock': { useStudyNow: (enabled, resolution) => { calls.push([enabled, resolution]); return enabled ? 1234 : 0; } },
  });
  assert.equal(useScreenNow(true, 60000), 1234);
  focused = false;
  assert.equal(useScreenNow(true, 60000), 0);
  focused = true;
  useScreenNow(false);
  useScreenNow(true);
  assert.deepEqual(calls, [[true, 60000], [false, 60000], [false, 1], [true, 1]]);
});

test('Android back listener survives ticking renders, calls latest handler, and cleans up on blur', () => {
  const slots = [];
  let cursor = 0, listener, additions = 0, removals = 0, called = '';
  const hook = (factory, deps) => {
    const index = cursor++;
    if (!slots[index] || deps.some((value, i) => value !== slots[index].deps[i])) {
      slots[index]?.cleanup?.();
      slots[index] = { deps, value: factory() };
    }
    return slots[index].value;
  };
  const react = {
    useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
    useEffect: effect => { effect(); },
    useCallback: (fn, deps) => hook(() => fn, deps),
  };
  const { useAndroidBack } = load('../src/features/navigation/useAndroidBack.ts', {
    react,
    'expo-router': { useFocusEffect: callback => { hook(() => callback(), [callback]); } },
    'react-native': { Platform: { OS: 'android' }, BackHandler: { addEventListener: (_event, callback) => { additions++; listener = callback; return { remove() { removals++; } }; } } },
  });
  for (let i = 0; i < 10; i++) { cursor = 0; useAndroidBack(() => { called = String(i); return true; }); }
  assert.equal(additions, 1);
  assert.equal(listener(), true);
  assert.equal(called, '9');
  // useFocusEffect owns the subscription cleanup returned by the effect.
  slots.at(-1).value();
  assert.equal(removals, 1);
});

test('common tab bar selects an existing route and retains Android back policy', () => {
  const calls = [];
  let onBack;
  const { MainTabBar } = load('../src/features/navigation/MainTabs.tsx', {
    'react/jsx-runtime': { jsx: (_type, props) => props },
    './useAndroidBack': { useAndroidBack: callback => { onBack = callback; } },
    './BottomTabs': {},
    './tab-animation': { TAB_ANIMATION: { durationMs: 100, distance: 14, fade: true } },
    '../../design/theme': { colors: {}, layout: {} },
    'react-native': { View: 'View', BackHandler: { exitApp: () => calls.push('exit') } },
    'expo-router': { router: { navigate: route => calls.push(`back:${route}`) } },
  });
  const routes = ['index', 'records', 'friends', 'leave', 'profile'].map(name => ({ name, key: `tab-${name}` }));
  const props = { state: { routes, index: 1 }, emitter: { emit: () => ({ defaultPrevented: false }) }, navigateToTab: key => calls.push(key) };
  const records = MainTabBar(props).children.children;
  records.onSelect('기록');
  records.onSelect('친구');
  assert.deepEqual(calls, ['tab-friends']);
  assert.equal(onBack(), true);
  assert.equal(calls.at(-1), 'back:/');
  MainTabBar({ ...props, state: { routes, index: 0 } });
  assert.equal(onBack(), true);
  assert.equal(calls.at(-1), 'exit');
  MainTabBar({ ...props, state: { routes, index: 3 } });
  assert.equal(onBack(), false);
  const blocked = MainTabBar({ ...props, emitter: { emit: () => ({ defaultPrevented: true }) } }).children.children;
  const count = calls.length;
  blocked.onSelect('나');
  assert.equal(calls.length, count);
});
