import test from 'node:test';
import assert from 'node:assert/strict';
import { createLayoutCache } from '../src/lib/layout-cache.ts';

test('measured sizes survive a restart and screen conditions remain separate', async () => {
  let saved = null;
  const storage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
  const first = createLayoutCache(storage);
  first.measure('home:390x844:normal', { width: 390, height: 360 });
  await first.flush();
  const restarted = createLayoutCache(storage);
  await restarted.hydrate();
  assert.deepEqual(restarted.read('home:390x844:normal'), { width: 390, height: 360 });
  assert.equal(restarted.read('home:844x390:normal'), null);
  assert.equal(restarted.read('home:390x844:large-font'), null);
});
test('late restoration never replaces a fresh measurement', async () => {
  let finish;
  const cache = createLayoutCache({ getItem: () => new Promise(resolve => { finish = resolve; }), setItem: () => {} });
  const hydration = cache.hydrate();
  await Promise.resolve();
  cache.measure('home', { width: 400, height: 300 });
  finish(JSON.stringify([['home', { width: 390, height: 360 }]]));
  await hydration;
  assert.deepEqual(cache.read('home'), { width: 400, height: 300 });
});
test('invalid storage and write failures do not block layout', async () => {
  const cache = createLayoutCache({ getItem: () => 'broken', setItem: () => { throw Error('storage unavailable'); } });
  await cache.hydrate();
  cache.measure('zero', { width: 0, height: 0 });
  assert.equal(cache.read('zero'), null);
  cache.measure('home', { width: 390, height: 360 });
  await cache.flush();
  assert.deepEqual(cache.read('home'), { width: 390, height: 360 });
});
