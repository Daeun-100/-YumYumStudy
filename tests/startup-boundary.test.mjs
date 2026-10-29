import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../src/components/StartupBoundary.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function mount(study) {
  const slots = [];
  let cursor = 0, effects = [], frames = [];
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react: {
      createContext: () => ({ Provider: 'StartupVisibility' }),
      useContext: () => false,
      useState: initial => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
        return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
      },
      useRef: value => { const index = cursor++; return slots[index] ??= { current: value }; },
      useEffect: (effect, deps) => {
        const index = cursor++;
        if (!slots[index] || deps.some((dep, i) => dep !== slots[index].deps[i])) {
          slots[index]?.cleanup?.();
          slots[index] = { deps };
          effects.push(() => { slots[index].cleanup = effect(); });
        }
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View' },
    './IdentityProvider': { useIdentity: () => ({ profile: { id: 'owner' }, loading: false, error: null }) },
    '../features/study/StudyProvider': { useStudy: () => study },
    './StartupScreen': { StartupScreen: 'StartupScreen' },
    '../lib/performance': { finishTiming: () => () => {} },
  };
  const context = { exports: {}, require: name => {
    assert.ok(name in modules, `unexpected startup dependency ${name}`);
    return modules[name];
  }, setTimeout: () => 1, clearTimeout: () => {}, requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame: () => {} };
  vm.runInNewContext(source, context);
  const render = () => {
    cursor = 0;
    const tree = context.exports.StartupBoundary({ children: 'navigation' });
    const pending = effects; effects = []; pending.forEach(fn => fn());
    return tree;
  };
  return { render, paint: () => { while (frames.length) { const pending = frames; frames = []; pending.forEach(fn => fn()); } } };
}

test('live owner readiness reveals navigation despite missing friends or friend errors, without image preloading', () => {
  for (const roomError of [null, 'friends offline']) {
    const app = mount({ today: { data: {} }, startupReady: true, room: null, roomError, loading: false });
    app.render(); app.paint();
    const tree = app.render();
    assert.equal(tree.props.children[0].props.pointerEvents, 'auto');
    assert.equal(tree.props.children[0].props.children.props.children, 'navigation');
    assert.equal(tree.props.children[0].props.children.props.value, true);
  }
});
test('missing live owner snapshot or unfinished request recovery keeps navigation locked', () => {
  for (const state of [{ today: null, startupReady: true }, { today: { data: {} }, startupReady: false }]) {
    const app = mount({ ...state, room: { data: [] }, loading: false });
    app.render(); app.paint();
    const tree = app.render();
    assert.equal(tree.props.children[0].props.pointerEvents, 'none');
    assert.equal(tree.props.children[0].props.children.props.value, false);
  }
});
