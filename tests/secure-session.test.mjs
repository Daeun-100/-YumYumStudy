import test from 'node:test';
import assert from 'node:assert/strict';
import { createSecureSessionStorage } from '../src/lib/secure-session-core.ts';
import { secureWebHtml } from '../scripts/secure-web-export.mjs';

const key = 'sb-project-auth-token';
function store() {
  const values = new Map();
  return { values, getItem: async k => values.get(k) ?? null, setItem: async (k, v) => { values.set(k, v); }, removeItem: async k => { values.delete(k); } };
}
function fixture() {
  const legacy = store(), secure = store();
  let id = 0;
  const storage = createSecureSessionStorage(legacy, secure, () => `id-${++id}`);
  return { legacy, secure, storage };
}
test('migrates a large existing session, removes plaintext and restores after restart', async () => {
  const { legacy, secure, storage } = fixture();
  const value = JSON.stringify({ refresh_token: 'secret', metadata: '고양이🐱'.repeat(1500) });
  legacy.values.set(key, value);
  assert.equal(await storage.getItem(key), value);
  assert.equal(legacy.values.has(key), false);
  assert.ok([...secure.values.values()].every(v => Buffer.byteLength(v) < 2048));
  const restarted = createSecureSessionStorage(legacy, secure, () => 'restart');
  assert.equal(await restarted.getItem(key), value);
});
test('failed migration keeps the existing identity and rejects instead of reporting no session', async () => {
  const { legacy, secure } = fixture();
  legacy.values.set(key, 'existing-session');
  secure.setItem = async () => { throw new Error('locked'); };
  const storage = createSecureSessionStorage(legacy, secure, () => 'fail');
  await assert.rejects(storage.getItem(key), /locked/);
  assert.equal(legacy.values.get(key), 'existing-session');
});
test('interrupted refresh retains the previous complete session; missing chunks fail closed', async () => {
  const { legacy, secure, storage } = fixture();
  await storage.setItem(key, 'old-session');
  const set = secure.setItem;
  secure.setItem = async (k, v) => { if (k.endsWith('.1')) throw new Error('disk full'); await set(k, v); };
  await assert.rejects(storage.setItem(key, 'x'.repeat(1000)), /disk full/);
  assert.equal(await storage.getItem(key), 'old-session');
  secure.values.delete('session-v1.sb-project-auth-token.id-1.0');
  legacy.values.set(key, 'stale-session');
  await assert.rejects(storage.getItem(key), /불완전/);
});
test('serializes migration with token refresh and isolates test/production credentials', async () => {
  const { legacy, storage } = fixture();
  legacy.values.set(key, 'old');
  const migration = storage.getItem(key);
  const refresh = storage.setItem(key, 'new');
  assert.equal(await migration, 'old');
  await refresh;
  const testKey = `${key}-test-room-0`;
  await storage.setItem(testKey, 'test');
  assert.equal(await storage.getItem(key), 'new');
  assert.equal(await storage.getItem(testKey), 'test');
  await storage.removeItem(key);
  assert.equal(await storage.getItem(key), null);
  assert.equal(await storage.getItem(testKey), 'test');
});
test('ordinary caches and known UID remain compatible with existing storage', async () => {
  const { legacy, secure, storage } = fixture();
  await storage.setItem('yumyumstudy.known-uid', 'same-user');
  assert.equal(await storage.getItem('yumyumstudy.known-uid'), 'same-user');
  assert.equal(legacy.values.get('yumyumstudy.known-uid'), 'same-user');
  assert.equal(secure.values.size, 0);
});
test('web policy hashes existing boot scripts and blocks injected inline handlers and external scripts', () => {
  const html = secureWebHtml('<html><head><script>window.boot=1</script><script src="/app.js"></script></head></html>', 'https://example.supabase.co');
  assert.match(html, /script-src 'self' 'sha256-/);
  assert.match(html, /script-src-attr 'none'/);
  assert.match(html, /connect-src 'self' https:\/\/example.supabase.co wss:\/\/example.supabase.co/);
  assert.doesNotMatch(html, /unsafe-eval|script-src[^;]*unsafe-inline/);
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<script>'));
  assert.ok(html.includes("img-src 'self' data: blob: https://example.supabase.co/storage/v1/object/public/event-artwork/"));
  assert.equal(html.includes("img-src *"), false);
  assert.throws(() => secureWebHtml('<head></head>', 'http://attacker.test'));
});
