import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';
import { createLayoutCache } from '../src/lib/layout-cache.ts';

const source = ts.transpileModule(readFileSync(new URL('../src/hooks/useMeasuredLayout.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

test('keyboard and rotation cache misses retain layout until remeasured, without sharing across slots', () => {
  let viewport = { width: 390, height: 844, scale: 3, fontScale: 1 };
  const cache = createLayoutCache({ getItem: () => null, setItem: () => {} });
  const context = {
    exports: {},
    require: name => {
      if (name === 'react') return React;
      if (name === 'react-native') return { Platform: { OS: 'web' }, useWindowDimensions: () => viewport };
      if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
      if (name === '../lib/layout-cache') return { createLayoutCache: () => cache };
      if (name === '../lib/session-storage') return { sessionStorage: {} };
      throw Error(`Unexpected import: ${name}`);
    },
  };
  vm.runInNewContext(source, context);
  const snapshots = [];
  const expected = [null, { width: 390, height: 420 }, { width: 390, height: 420 },
    { width: 390, height: 240 }, { width: 390, height: 240 }, { width: 844, height: 180 }, null];
  function Harness() {
    const [step, setStep] = React.useState(0);
    viewport = step < 2 ? { width: 390, height: 844, scale: 3, fontScale: 1 }
      : step < 4 ? { width: 390, height: 510, scale: 3, fontScale: 1 }
        : { width: 844, height: 390, scale: 3, fontScale: 1 };
    const layout = context.exports.useMeasuredLayout(step === 6 ? 'home-art' : 'focus-art', String(viewport.height < 740));
    snapshots.push({ step, size: layout.size });
    if (step === 0 || step === 2 || step === 4) {
      layout.onLayout({ nativeEvent: { layout: expected[step + 1] } });
    }
    if (step < 6) setStep(step + 1);
    return null;
  }
  renderToString(React.createElement(Harness));
  assert.equal(new Set(snapshots.map(snapshot => snapshot.step)).size, 7);
  for (const { step, size } of snapshots) {
    assert.deepEqual(size, expected[step], `layout during transition ${step}`);
  }
});
