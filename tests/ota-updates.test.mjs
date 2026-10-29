import test from 'node:test';
import assert from 'node:assert/strict';
import { createOtaController } from '../src/features/ota/controller.ts';
import { blockUpdateReload, updateReloadBlocked, beginUpdateReload, cancelUpdateReload, isUpdateReloading } from '../src/features/ota/reload-gate.ts';

function fixture(overrides = {}) {
  const state = { active: true, safe: true, now: 100_000, checks: 0, downloads: 0, reloads: 0, prepares: 0, notices: 0, begins: 0, cancels: 0 };
  const deps = {
    active: () => state.active, safe: () => state.safe, now: () => state.now,
    check: async () => { state.checks++; return { isAvailable: true, isRollBackToEmbedded: false }; },
    fetch: async () => { state.downloads++; return { isNew: true, isRollBackToEmbedded: false }; },
    prepare: async () => { state.prepares++; return true; },
    begin: () => { state.begins++; return true; },
    reload: async () => { state.reloads++; state.safe = false; },
    cancel: () => { state.cancels++; }, changed: () => { state.notices++; },
    ...overrides,
  };
  return { state, controller: createOtaController(deps) };
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('downloads while studying but waits for a safe saved state before automatic reload', async () => {
  const { state, controller } = fixture();
  state.safe = false;
  await controller.check();
  assert.equal(state.downloads, 1);
  assert.equal(controller.isPending(), true);
  await controller.apply();
  assert.equal(state.prepares, 0);
  state.safe = true;
  await controller.apply();
  assert.equal(state.reloads, 1);
  await controller.apply();
  assert.equal(state.reloads, 1);
});

test('deduplicates startup/resume checks and throttles no-update checks', async () => {
  const request = deferred();
  const { state, controller } = fixture({ check: async () => { state.checks++; return request.promise; } });
  const flight = controller.check();
  await controller.check();
  request.resolve({ isAvailable: false, isRollBackToEmbedded: false });
  await flight;
  await controller.check();
  assert.equal(state.checks, 1);
  state.now += 60_000;
  await controller.check();
  assert.equal(state.checks, 2);
  assert.equal(state.downloads, 0);
});

test('offline failure stays usable and retries on a later foreground check', async () => {
  const { state, controller } = fixture({ fetch: async () => { state.downloads++; if (state.downloads === 1) throw Error('offline'); return { isNew: true }; } });
  await controller.check();
  assert.equal(controller.isPending(), false);
  state.now += 60_000;
  await controller.check();
  assert.equal(controller.isPending(), true);
});

test('observes a download from the built-in startup check without fetching twice', async () => {
  const { state, controller } = fixture();
  controller.downloaded(); controller.downloaded();
  await controller.check();
  assert.equal(state.checks, 0);
  assert.equal(state.notices, 1);
  await controller.apply();
  assert.equal(state.reloads, 1);
});

for (const reason of ['timer started', 'draft/dialog opened', 'save began', 'backgrounded', 'unmounted']) {
  test(`rechecks eligibility after server/native preparation: ${reason}`, async () => {
    const prep = deferred();
    const { state, controller } = fixture({ prepare: () => prep.promise });
    controller.downloaded();
    const flight = controller.apply();
    await controller.apply();
    if (reason === 'backgrounded') state.active = false;
    else if (reason === 'unmounted') controller.dispose();
    else state.safe = false;
    prep.resolve(true); await flight;
    assert.equal(state.reloads, 0);
    assert.equal(state.begins, 0);
  });
}

test('failed server/native reconciliation defers reload with a bounded retry rate', async () => {
  const { state, controller } = fixture({ prepare: async () => { state.prepares++; return false; } });
  controller.downloaded();
  await controller.apply(); await controller.apply();
  assert.equal(state.prepares, 1);
  assert.equal(state.reloads, 0);
  state.now += 60_000;
  await controller.apply();
  assert.equal(state.prepares, 2);
});

test('reload failure releases the gate and retries later without losing the download', async () => {
  const { state, controller } = fixture({ reload: async () => { state.reloads++; throw Error('reload failed'); } });
  controller.downloaded();
  await controller.apply(); await controller.apply();
  assert.equal(state.cancels, 1);
  assert.equal(controller.isPending(), true);
  state.now += 60_000;
  await controller.apply();
  assert.equal(state.reloads, 2);
});

test('rollback directives are downloaded and applied through the same safety checks', async () => {
  const { state, controller } = fixture({
    check: async () => ({ isAvailable: false, isRollBackToEmbedded: true }),
    fetch: async () => ({ isNew: false, isRollBackToEmbedded: true }),
  });
  await controller.check(); await controller.apply();
  assert.equal(state.reloads, 1);
});

test('background does not check the server or apply a pending download', async () => {
  const { state, controller } = fixture();
  state.active = false;
  await controller.check(); controller.downloaded(); await controller.apply();
  assert.equal(state.checks, 0); assert.equal(state.reloads, 0);
});

test('disposing during download never starts a reload or updates the UI', async () => {
  const request = deferred();
  const { state, controller } = fixture({ fetch: () => request.promise });
  const flight = controller.check();
  await Promise.resolve();
  controller.dispose();
  request.resolve({ isNew: true }); await flight; await controller.apply();
  assert.equal(state.notices, 0); assert.equal(state.reloads, 0);
});

test('nested draft blockers and the synchronous reload lock protect new actions', () => {
  const closeFirst = blockUpdateReload(); const closeSecond = blockUpdateReload();
  assert.equal(beginUpdateReload(), false);
  closeFirst(); closeFirst();
  assert.equal(updateReloadBlocked(), true);
  closeSecond();
  assert.equal(beginUpdateReload(), true);
  assert.equal(isUpdateReloading(), true);
  assert.equal(beginUpdateReload(), false);
  cancelUpdateReload();
  assert.equal(updateReloadBlocked(), false);
});
