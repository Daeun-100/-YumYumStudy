import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createHookRuntime } from './helpers/hooks.mjs';
import { decodeCampaign } from '../src/features/admin-toasts/model.ts';
const source = ts.transpileModule(readFileSync(new URL('../src/features/admin-toasts/useCampaigns.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
function mount() {
  const hooks = createHookRuntime(), reads = [], channels = [];
  let refresh, active = true, generation = 0;
  const request = async () => {};
  const client = { realtime: { setAuth: async () => {} }, rpc: () => new Promise(resolve => reads.push(resolve)), removeChannel: async c => { c.removed = true; },
    channel: (name, options) => { const c = { name, options, on(_type, _filter, callback) { c.changed = callback; return c; }, subscribe(callback) { c.status = callback; return c; } }; channels.push(c); return c; } };
  const modules = { react: hooks.react, '../../lib/supabase': { getSupabase: () => client },
    '../../hooks/useResourceRefresh': { useResourceRefresh: options => { refresh = options.refresh; return { request }; } },
    '../../hooks/useAppActive': { useAppActive: () => active }, '../../lib/with-timeout': { withTimeout: promise => promise }, './model': { decodeCampaign } };
  const ctx = { exports: {}, require: name => modules[name], performance: { now: () => ++generation }, console, setTimeout, clearTimeout };
  vm.runInNewContext(source, ctx);
  return { reads, channels, read: () => refresh(), render: (scope = 'A', room = 1) => hooks.render(() => ctx.exports.useCampaigns(scope, room, true)),
    background: () => { active = false; }, resume: () => { active = true; }, dispose: hooks.dispose };
}
const reply = { data: { server_now: new Date().toISOString(), campaigns: [] }, error: null };
test('old user/room response cannot become current after A → B → A', async () => {
  const app = mount(); app.render('A'); await flush();
  const pending = app.read(); app.render('B', 0); app.render('A');
  app.reads.shift()(reply); await pending; assert.equal(app.render('A'), null); app.dispose();
});
test('background invalidates config and returning requires a new authoritative read', async () => {
  const app = mount(); app.render(); await flush(); const pending = app.read(); app.reads.shift()(reply); await pending;
  assert.ok(app.render()); app.background(); assert.equal(app.render(), null);
  app.resume(); assert.equal(app.render(), null); await flush();
  const next = app.read(); app.reads.shift()(reply); await next; assert.ok(app.render()); app.dispose();
});
test('change during an in-flight read discards its snapshot and private room channels are cleaned up', async () => {
  const app = mount(); app.render(); await flush(); const c = app.channels[0];
  assert.equal(c.name, 'admin-toasts:room:1'); assert.equal(c.options.config.private, true);
  const pending = app.read(); c.changed(); app.reads.shift()(reply); await pending;
  assert.equal(app.render(), null);
  app.render('B', 0); assert.ok(c.removed); app.dispose();
});
