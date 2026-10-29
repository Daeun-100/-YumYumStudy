import test from 'node:test';
import assert from 'node:assert/strict';
import { createOtaController } from '../src/features/ota/controller.ts';
import { blockUpdateReload, updateReloadBlocked, beginUpdateReload, cancelUpdateReload, isUpdateReloading } from '../src/features/ota/reload-gate.ts';

function fixture(overrides = {}) {
  const state = { active: true, safe: true, now: 100_000, checks: 0, downloads: 0, reloads: 0, prepares: 0, begins: 0, cancels: 0, snapshots: [] };
  const deps = {
    active: () => state.active, safe: () => state.safe, now: () => state.now,
    check: async () => { state.checks++; return { isAvailable: true, isRollBackToEmbedded: false }; },
    fetch: async () => { state.downloads++; return { isNew: true, isRollBackToEmbedded: false }; },
    prepare: async () => { state.prepares++; return true; },
    begin: () => { state.begins++; return true; },
    reload: async () => { state.reloads++; }, cancel: () => { state.cancels++; },
    changed: snapshot => state.snapshots.push(snapshot), ...overrides,
  };
  return { state, controller: createOtaController(deps) };
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('download completion and foreground checks never reload, even after study ends', async () => {
  const { state, controller } = fixture();
  state.safe = false; await controller.check();
  assert.equal(state.downloads, 1); assert.equal(controller.isPending(), true);
  state.safe = true;
  for (let i = 0; i < 3; i++) { state.now += 60_000; await controller.check(); }
  assert.equal(state.prepares, 0); assert.equal(state.reloads, 0);
  assert.deepEqual(state.snapshots.map(s => s.phase), ['checking', 'downloading', 'downloading', 'idle']);
});

test('only an explicit apply action prepares and reloads a ready update once', async () => {
  const { state, controller } = fixture(); await controller.check();
  assert.equal(await controller.apply(), 'applied');
  assert.equal(await controller.apply(), 'not-ready');
  assert.equal(state.prepares, 1); assert.equal(state.reloads, 1);
  assert.equal(state.snapshots.at(-1).phase, 'applying');
});

test('studying or saving blocks the click without starting preparation or scheduling a retry', async () => {
  const { state, controller } = fixture(); controller.downloaded(); state.safe = false;
  assert.equal(await controller.apply(), 'blocked'); assert.equal(state.prepares, 0);
  state.safe = true; state.now += 600_000; await controller.check();
  assert.equal(state.reloads, 0);
  assert.equal(await controller.apply(), 'applied');
});

test('automatic checks deduplicate and throttle; manual checks bypass the cooldown', async () => {
  const request = deferred();
  const { state, controller } = fixture({ check: async () => { state.checks++; return request.promise; } });
  const flight = controller.check(); await controller.check(true);
  request.resolve({ isAvailable: false, isRollBackToEmbedded: false }); assert.equal(await flight, 'latest');
  assert.equal(await controller.check(), 'skipped'); assert.equal(state.checks, 1);
  assert.equal(await controller.check(true), 'latest'); assert.equal(state.checks, 2);
  state.now += 60_000; await controller.check(); assert.equal(state.checks, 3);
});

test('offline download returns idle and manual retry preserves the current app', async () => {
  const { state, controller } = fixture({ fetch: async () => { state.downloads++; if (state.downloads === 1) throw Error('offline'); return { isNew: true }; } });
  assert.equal(await controller.check(), 'failed'); assert.equal(controller.isPending(), false);
  assert.equal(state.snapshots.at(-1).phase, 'idle');
  assert.equal(await controller.check(true), 'ready'); assert.equal(state.reloads, 0);
});

test('built-in startup downloads become ready without duplicate fetch or automatic reload', async () => {
  const { state, controller } = fixture(); controller.downloaded(); controller.downloaded();
  assert.equal(state.snapshots.length, 1); assert.equal(await controller.check(), 'ready');
  assert.equal(state.checks, 0); assert.equal(state.reloads, 0);
});

for (const reason of ['timer started', 'draft/dialog opened', 'save began', 'backgrounded', 'unmounted']) {
  test(`manual apply rechecks after preparation: ${reason}`, async () => {
    const prep = deferred(); const { state, controller } = fixture({ prepare: () => prep.promise });
    controller.downloaded(); const flight = controller.apply();
    assert.equal(await controller.apply(), 'not-ready');
    if (reason === 'backgrounded') state.active = false;
    else if (reason === 'unmounted') controller.dispose(); else state.safe = false;
    prep.resolve(true); assert.equal(await flight, 'blocked');
    assert.equal(state.reloads, 0); assert.equal(state.begins, 0);
  });
}

test('failed reconciliation never reloads and requires another click to retry', async () => {
  const { state, controller } = fixture({ prepare: async () => { state.prepares++; return state.prepares > 1; } });
  controller.downloaded(); assert.equal(await controller.apply(), 'blocked');
  state.now += 60_000; await controller.check(); assert.equal(state.prepares, 1);
  assert.equal(await controller.apply(), 'applied');
});

test('reload failure releases the gate, keeps the download, and allows manual retry', async () => {
  const { state, controller } = fixture({ reload: async () => { state.reloads++; if (state.reloads === 1) throw Error('reload failed'); } });
  controller.downloaded(); assert.equal(await controller.apply(), 'failed');
  assert.equal(state.cancels, 1); assert.equal(controller.isPending(), true);
  assert.equal(state.snapshots.at(-1).phase, 'idle');
  assert.equal(await controller.apply(), 'applied'); assert.equal(state.reloads, 2);
});

test('rollback waits for an explicit apply action and uses the same safety checks', async () => {
  const { state, controller } = fixture({ check: async () => ({ isAvailable: false, isRollBackToEmbedded: true }), fetch: async () => ({ isNew: false, isRollBackToEmbedded: true }) });
  await controller.check(); assert.equal(state.reloads, 0);
  assert.equal(await controller.apply(), 'applied'); assert.equal(state.reloads, 1);
});

test('background does not check or apply updates', async () => {
  const { state, controller } = fixture(); state.active = false;
  assert.equal(await controller.check(), 'skipped'); controller.downloaded();
  assert.equal(await controller.apply(), 'blocked'); assert.equal(state.checks, 0); assert.equal(state.reloads, 0);
});

test('disposing during a download stops UI changes and reloads', async () => {
  const request = deferred(); const { state, controller } = fixture({ fetch: () => request.promise });
  const flight = controller.check(); await Promise.resolve();
  controller.dispose(); const before = state.snapshots.length;
  request.resolve({ isNew: true }); await flight; await controller.apply();
  assert.equal(state.snapshots.length, before); assert.equal(state.reloads, 0);
});

test('a failed gate acquisition does not reload', async () => {
  const { state, controller } = fixture({ begin: () => false }); controller.downloaded();
  assert.equal(await controller.apply(), 'blocked'); assert.equal(state.reloads, 0);
});

test('nested drafts and the synchronous reload lock protect new actions', () => {
  const first = blockUpdateReload(), second = blockUpdateReload();
  assert.equal(beginUpdateReload(), false); first(); first(); assert.equal(updateReloadBlocked(), true);
  second(); assert.equal(beginUpdateReload(), true); assert.equal(isUpdateReloading(), true);
  assert.equal(beginUpdateReload(), false); cancelUpdateReload(); assert.equal(updateReloadBlocked(), false);
});
