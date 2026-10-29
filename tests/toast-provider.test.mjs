import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createHookRuntime } from './helpers/hooks.mjs';
import { createToastStore } from '../src/design/toast/store.ts';
const source = ts.transpileModule(readFileSync(new URL('../src/design/toast/ToastProvider.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function mount() {
  const hooks = createHookRuntime();
  const environment = { ready: true, active: true, blocked: false, reducedMotion: false, screenReader: false };
  const modules = {
    react: hooks.react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { Animated: {}, StyleSheet: { create: value => value }, View: 'View' },
    'lucide-react-native': {}, '../theme': { colors: {}, layout: {}, typography: {} },
    './store': { createToastStore }, './useToastEnvironment': { useToastEnvironment: () => environment },
  };
  const context = { exports: {}, require: name => { assert.ok(name in modules, name); return modules[name]; } };
  vm.runInNewContext(source, context);
  return { environment, render(scope, enabled = true) { return hooks.render(() => context.exports.ToastProvider({ scope, enabled, children: null })); }, dispose: hooks.dispose };
}
test('API callbacks from an earlier visit cannot publish after room A → B → A', () => {
  const app = mount(), firstA = app.render('A').props.value;
  const oldId = firstA.show({ title: '이전 작업' }); assert.ok(oldId);
  app.render('B'); const newA = app.render('A').props.value;
  assert.equal(firstA.show({ title: '늦은 이전 작업 응답' }), null);
  assert.equal(firstA.update(oldId, { title: '늦은 갱신' }), false);
  assert.ok(newA.show({ title: '현재 작업' })); app.dispose();
});
test('API remains stable as queue contents change, preventing registration loops', () => {
  const app = mount(), first = app.render('A').props.value;
  first.show({ title: '안내' }); const next = app.render('A').props.value;
  assert.equal(next.show, first.show); assert.equal(next.update, first.update);
  assert.equal(next.environment, first.environment); app.dispose();
});
test('startup disabled rejects calls and becomes available after admission', () => {
  const app = mount(), before = app.render('A', false).props.value;
  assert.equal(before.show({ title: '입장 전' }), null);
  const after = app.render('A', true).props.value;
  assert.ok(after.show({ title: '입장 후' })); app.dispose();
});
