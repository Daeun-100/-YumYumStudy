import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { createVersionReporter } from '../src/features/app-version/report-core.ts';

const version = { platform: 'android', appVersion: '1.0.2', buildVersion: '3',
  updateId: null, runtimeVersion: 'runtime', embedded: true, webBuildId: null, appVariant: 'production' };

test('startup and resume share a flight, then throttle successful observations for 15 minutes', async () => {
  let finish;
  let calls = 0;
  let time = 0;
  const report = createVersionReporter(async () => {
    calls++;
    if (calls === 1) await new Promise(resolve => { finish = resolve; });
  }, () => time);
  const first = report('1:user', version);
  assert.equal(report('1:user', version), first);
  await Promise.resolve();
  assert.equal(calls, 1);
  finish();
  await first;
  time = 15 * 60 * 1000 - 1;
  await report('1:user', version);
  assert.equal(calls, 1);
  time++;
  await report('1:user', version);
  assert.equal(calls, 2);
});

test('changed versions and different identities bypass the success throttle', async () => {
  const sent = [];
  const report = createVersionReporter(async value => { sent.push(value); }, () => 100);
  await report('1:a', version);
  await report('1:a', { ...version, embedded: false, updateId: 'new-update' });
  await report('1:b', version);
  await report('0:a', version);
  assert.equal(sent.length, 4);
});

test('offline failures release the flight and do not mark a version as reported', async () => {
  let calls = 0;
  const report = createVersionReporter(async () => { if (++calls === 1) throw Error('offline'); });
  await assert.rejects(report('1:user', version), /offline/);
  await report('1:user', version);
  await report('1:user', version);
  assert.equal(calls, 2);
});

test('clock rollback does not suppress a fresh observation indefinitely', async () => {
  let time = 10000;
  let calls = 0;
  const report = createVersionReporter(async () => { calls++; }, () => time);
  await report('1:user', version);
  time = 1;
  await report('1:user', version);
  assert.equal(calls, 2);
});

const { transpileModule, ModuleKind } = createRequire(import.meta.url)('typescript');
function loadReader(file, modules, env = {}, dev = false) {
  const code = transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {}, process: { env }, __DEV__: dev, require(name) {
    if (!Object.hasOwn(modules, name)) throw Error(`Module unavailable: ${name}`);
    return modules[name];
  } };
  vm.runInNewContext(code, context);
  return context.exports.readCurrentVersion;
}

test('native reader reports installed binary and running OTA rather than downloaded updates', async () => {
  const reader = loadReader('../src/features/app-version/current-version.ts', {
    'react-native': { Platform: { OS: 'android' } },
    '../../lib/room': { isTestBuild: false },
    'expo-application': { nativeApplicationVersion: '1.0.2', nativeBuildVersion: '3' },
    'expo-updates': { isEnabled: true, updateId: 'running-update', runtimeVersion: 'runtime',
      isEmbeddedLaunch: false, downloadedUpdate: { updateId: 'not-yet-running' } },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(await reader())), {
    ...version, embedded: false, updateId: 'running-update',
  });
});

test('a missing application module is deferred until reporting and development skips it', async () => {
  const modules = {
    'react-native': { Platform: { OS: 'android' } },
    '../../lib/room': { isTestBuild: false },
    'expo-updates': { isEnabled: false },
  };
  const reader = loadReader('../src/features/app-version/current-version.ts', modules);
  await assert.rejects(reader(), /Module unavailable/);
  const devReader = loadReader('../src/features/app-version/current-version.ts', modules, {}, true);
  assert.equal(await devReader(), null);
});

test('web reader requires an embedded build SHA and carries no native version fields', async () => {
  const modules = {
    '../../../app.json': { expo: { version: '1.0.2' } },
    '../../lib/room': { isTestBuild: true },
  };
  const file = '../src/features/app-version/current-version.web.ts';
  assert.equal(loadReader(file, modules)(), null);
  assert.equal(loadReader(file, modules, { EXPO_PUBLIC_BUILD_SHA: 'unknown' })(), null);
  const report = loadReader(file, modules, { EXPO_PUBLIC_BUILD_SHA: 'b'.repeat(40) })();
  assert.deepEqual(JSON.parse(JSON.stringify(report)), {
    platform: 'web', appVersion: '1.0.2', buildVersion: null, updateId: null,
    runtimeVersion: null, embedded: null, webBuildId: 'b'.repeat(40), appVariant: 'test',
  });
});
