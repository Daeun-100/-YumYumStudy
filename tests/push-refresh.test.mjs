import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const { transpileModule, ModuleKind } = createRequire(import.meta.url)('typescript');
import { createPushRefresh } from '../src/features/call-friend/push-refresh.ts';

test('overlapping startup/resume registrations share one request', async () => {
  let release;
  let calls = 0;
  const refresh = createPushRefresh(async () => { calls++; await new Promise(resolve => { release = resolve; }); });
  const first = refresh(0);
  assert.equal(refresh(0), first);
  await Promise.resolve();
  assert.equal(calls, 1);
  release();
  await first;
});

test('token rotation during registration sends the latest emitted token without fetching again', async () => {
  let release;
  const tokens = [];
  const refresh = createPushRefresh(async token => {
    tokens.push(token);
    if (tokens.length === 1) await new Promise(resolve => { release = resolve; });
  });
  const first = refresh(0);
  await Promise.resolve();
  refresh(0, 'old');
  refresh(0, 'latest');
  release();
  await first;
  assert.deepEqual(tokens, [undefined, 'latest']);
});

test('failed registration releases the flight for a later retry', async () => {
  let calls = 0;
  const refresh = createPushRefresh(async () => { if (++calls === 1) throw Error('offline'); });
  await assert.rejects(refresh(0));
  await refresh(0);
  assert.equal(calls, 2);
});

test('real push adapter handles native token event without querying the device token again', async () => {
  let listener;
  let nativeReads = 0;
  let registrations = 0;
  const emitted = { type: 'android', data: 'device-token' };
  const storage = new Map([['friend-call-opt-in', 'true']]);
  const notifications = {
    AndroidImportance: { HIGH: 4 },
    setNotificationHandler() {},
    setNotificationChannelAsync: async () => {},
    getPermissionsAsync: async () => ({ granted: true }),
    getExpoPushTokenAsync: async options => {
      if (!options.devicePushToken) {
        nativeReads++;
        assert.ok(nativeReads < 3, 'native token retrieval must not recurse');
        listener(emitted);
      } else assert.equal(options.devicePushToken, emitted);
      return { data: 'expo-token' };
    },
    addPushTokenListener: callback => { listener = callback; return { remove() {} }; },
    addNotificationResponseReceivedListener: () => ({ remove() {} }),
    getLastNotificationResponseAsync: async () => null,
  };
  const modules = {
    'expo-notifications': notifications,
    'expo-constants': { __esModule: true, default: { easConfig: { projectId: 'project' } } },
    'react-native': { Platform: { OS: 'android' } },
    './api': { callService: async () => { registrations++; return { deviceId: 'device' }; } },
    './push-refresh': { createPushRefresh },
    '../../lib/room': { studyRoomId: 0, roomStorageKey: key => key },
    '../../lib/session-storage': { sessionStorage: {
      getItem: async key => storage.get(key),
      setItem: async (key, value) => storage.set(key, value),
    } },
  };
  const source = readFileSync(new URL('../src/features/call-friend/push.ts', import.meta.url), 'utf8');
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: name => {
    assert.ok(name in modules, `unexpected dependency ${name}`);
    return modules[name];
  } });
  exports.listenForCalls(() => {});
  await exports.refreshPush();
  assert.equal(nativeReads, 1);
  assert.equal(registrations, 2); // Initial registration plus the queued emitted token.
});
