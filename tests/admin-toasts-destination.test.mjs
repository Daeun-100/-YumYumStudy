import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createHookRuntime } from './helpers/hooks.mjs';
const source = ts.transpileModule(readFileSync(new URL('../src/features/admin-toasts/UpdateDestination.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function mount() {
  const hooks = createHookRuntime(), jobs = new Map(), routes = [];
  let next = 0;
  const modules = { react: hooks.react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) }, 'expo-router': { router: { navigate: route => routes.push(route) } } };
  const context = { exports: {}, require: name => modules[name],
    setTimeout: run => { jobs.set(++next, run); return next; }, clearTimeout: id => jobs.delete(id) };
  vm.runInNewContext(source, context);
  return { render: () => hooks.render(() => context.exports.UpdateDestinationProvider({ children: null })).props.value,
    routes, timeout: () => [...jobs.values()].forEach(run => run()), dispose: hooks.dispose };
}
test('navigation does not complete until the matching destination reports visibility', async () => {
  const app = mount(); let done = false;
  const promise = app.render().open('campaign').then(() => { done = true; });
  const state = app.render(); assert.equal(state.attempt.campaignId, 'campaign');
  assert.deepEqual(app.routes, ['/profile']); state.ready(state.attempt.id + 1);
  await Promise.resolve(); assert.equal(done, false);
  state.ready(state.attempt.id); await promise;
  assert.equal(app.render().attempt, null); app.dispose();
});
test('cancelled attempt and late destination callback cannot dismiss the next campaign', async () => {
  const app = mount(), api = app.render();
  const first = api.open('first').catch(() => 'cancelled'); const old = app.render().attempt;
  api.cancel('first'); assert.equal(await first, 'cancelled');
  let done = false; const second = api.open('second').then(() => { done = true; }); const current = app.render().attempt;
  api.ready(old.id); await Promise.resolve(); assert.equal(done, false);
  assert.equal(app.render().attempt.id, current.id);
  api.ready(current.id); await second; app.dispose();
});
test('missing destination times out so the toast can offer retry', async () => {
  const app = mount(); const pending = app.render().open('campaign');
  const rejection = assert.rejects(pending, /Destination not visible/);
  app.timeout(); await rejection; assert.equal(app.render().attempt, null); app.dispose();
});
