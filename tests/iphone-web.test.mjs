import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOptions, selectIphone } from '../scripts/iphone-web.mjs';

test('iPhone launcher validates ports and rejects incomplete options', () => {
  assert.deepEqual(parseOptions(['--port', '8093', '--device', 'phone']), { port: 8093, device: 'phone', help: false });
  for (const args of [['--port'], ['--port', '0'], ['--port', '65536'], ['--port', 'abc'], ['--device'], ['--other']]) {
    assert.throws(() => parseOptions(args));
  }
});

test('iPhone launcher reuses a booted iPhone and never selects iPad or unavailable devices', () => {
  const shut = { name: 'iPhone 17', udid: 'one', isAvailable: true, state: 'Shutdown' };
  const booted = { ...shut, udid: 'two', name: 'iPhone 17 Pro', state: 'Booted' };
  const devices = { ios: [{ ...booted, name: 'iPad' }, { ...booted, isAvailable: false }, shut, booted] };
  assert.equal(selectIphone(devices), booted);
  assert.equal(selectIphone(devices, 'one'), shut);
  assert.throws(() => selectIphone(devices, 'missing'));
  assert.throws(() => selectIphone({}));
  assert.throws(() => selectIphone({ ios: [shut, { ...shut, udid: 'duplicate' }] }, 'iPhone 17'));
});
