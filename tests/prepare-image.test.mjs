import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareImage } from '../src/lib/prepare-image.ts';

const expected = { width: 1536, height: 1024 };
const uri = 'https://example.test/background.png';
const loader = result => ({
  prefetch: async () => result,
  getSize: (_, success) => success(expected.width, expected.height),
});

test('native true and web void both prepare the same artwork', async () => {
  for (const result of [true, undefined]) await prepareImage(loader(result), uri, expected);
});

test('explicit native failure and rejected downloads remain failures', async () => {
  await assert.rejects(prepareImage(loader(false), uri, expected), /Image unavailable/);
  await assert.rejects(prepareImage({ ...loader(true), prefetch: async () => { throw Error('offline'); } }, uri, expected), /offline/);
});

test('both platforms reject invalid dimensions and size loading errors', async () => {
  for (const result of [true, undefined]) {
    await assert.rejects(prepareImage(loader(result), uri, { width: 1, height: 1 }), /Image dimensions changed/);
    await assert.rejects(prepareImage({ ...loader(result), getSize: (_, __, failure) => failure(Error('decode failed')) }, uri, expected), /decode failed/);
  }
});

test('installed React Native Web loader really resolves void and passes preparation', async () => {
  const source = await readFile(new URL('../node_modules/react-native-web/dist/modules/ImageLoader/index.js', import.meta.url), 'utf8');
  const { default: webLoader } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const previous = globalThis.window;
  globalThis.window = { Image: class {
    naturalWidth = expected.width;
    naturalHeight = expected.height;
    set src(value) { queueMicrotask(() => this.onload?.({ target: this })); }
  } };
  try {
    assert.equal(await webLoader.prefetch(uri), undefined);
    await prepareImage(webLoader, uri, expected);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});
