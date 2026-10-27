import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { validMessage, validWebSubscription, validExpoToken } from '../supabase/functions/call-friend/validation.ts';

test('push destinations reject SSRF, credentials, invalid keys and unexpected hosts', () => {
  const sub = { endpoint: 'https://web.push.apple.com/Q123', keys: { auth: 'a'.repeat(22), p256dh: 'b'.repeat(87) } };
  assert.equal(validWebSubscription(sub), true);
  for (const endpoint of ['http://web.push.apple.com/a','https://127.0.0.1/a','https://web.push.apple.com.evil.example/a','https://evil.push.apple.com@evil.example/a','https://web.push.apple.com:444/a']) {
    assert.equal(validWebSubscription({ ...sub, endpoint }), false, endpoint);
  }
  assert.equal(validWebSubscription({ ...sub, keys: { auth: 'bad', p256dh: 'bad' } }), false);
  assert.equal(validExpoToken('ExpoPushToken[abc_123]'), true);
  assert.equal(validExpoToken('https://attacker.example'), false);
});
test('message limit counts unicode characters and rejects invisible controls', () => {
  assert.equal(validMessage('🍀'.repeat(40)), true);
  assert.equal(validMessage('🍀'.repeat(41)), false);
  assert.equal(validMessage(' \n '), false);
  assert.equal(validMessage('안녕\n친구'), false);
  assert.equal(validMessage(' 같이 공부해요 '), true);
});
test('web push uses branded notification, and click only opens our origin with the correct room', async () => {
  const listeners = {}; const shown = []; const opened = [];
  const self = { addEventListener: (name, handler) => { listeners[name] = handler; },
    location: { origin: 'https://study.example' },
    registration: { showNotification: async (...args) => { shown.push(args); } },
    clients: { matchAll: async () => [], openWindow: async value => { opened.push(value); } },
  };
  runInNewContext(readFileSync(new URL('../public/call-worker.js', import.meta.url), 'utf8'), { self, URL });
  let pending;
  listeners.push({ data: { json: () => ({ title: '친구님이 불렀어요!', body: '공부하자', roomId: 0, callId: 'x', url: 'https://evil.example' }) }, waitUntil: p => { pending = p; } });
  await pending;
  assert.equal(shown[0][1].icon, '/call-logo.png');
  assert.equal(shown[0][1].body, '공부하자');
  listeners.notificationclick({ notification: { close() {}, data: { roomId: 0, url: 'https://evil.example' } }, waitUntil: p => { pending = p; } });
  await pending;
  assert.deepEqual(opened, ['https://study.example/?friendCallRoom=0']);
  listeners.push({ data: { json: () => ({ title: 'bad', body: 'bad', roomId: 99 }) }, waitUntil: p => { pending = p; } });
  await pending;
  assert.equal(shown.length, 1);
});
