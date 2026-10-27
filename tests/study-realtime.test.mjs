import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('room subscription listens to both member and session changes, and stops after cleanup', () => {
  const handlers = [];
  let removed = 0;
  const channel = {
    on: (kind, filter, callback) => { handlers.push({ kind, filter, callback }); return channel; },
    subscribe: () => channel,
  };
  const source = ts.transpileModule(readFileSync(new URL('../src/data/study.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const modules = {
    '../lib/supabase': { getSupabase: () => ({ channel: () => channel, removeChannel: async () => { removed++; } }) },
    '../lib/room': { studyRoomId: 1 },
    '../lib/study-start-core': { createStudyStarter: () => ({}) },
  };
  const context = { exports: {}, require: name => modules[name] ?? {} };
  vm.runInNewContext(source, context);
  let changes = 0;
  const unsubscribe = context.exports.subscribeStudyChanges(() => { changes++; }, () => {});
  const events = handlers.filter(handler => handler.kind === 'postgres_changes');
  assert.deepEqual(events.map(event => event.filter.table), ['study_sessions', 'profiles']);
  for (const event of events) {
    assert.equal(event.filter.filter, 'room_id=eq.1');
    event.callback();
  }
  assert.equal(changes, 2);
  unsubscribe();
  events.forEach(event => event.callback());
  assert.equal(changes, 2);
  assert.equal(removed, 1);
});
