import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeCampaign, eligible, orderCampaigns } from '../src/features/admin-toasts/model.ts';
import { createToastHistory } from '../src/features/admin-toasts/storage.ts';
import { parseInput } from '../supabase/functions/admin-toasts/core.ts';
import { prepare, request, deploymentTarget } from '../scripts/admin-toasts.mjs';
const id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', group = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const now = Date.now();
const campaign = () => ({ id, schema_version: 1, kind: 'update_ready', room_id: 1, starts_at: new Date(now - 1000).toISOString(), expires_at: new Date(now + 100000).toISOString(), platforms: ['android'], app_variant: 'production', min_capability_version: 1, revision: 1, payload: { updateId: id, groupId: group, channel: 'production', runtimeVersion: 'runtime-1' } });
const context = () => ({ room: 1, platform: 'android', variant: 'production', now, ota: { enabled: true, pending: true, downloadedId: id, runningId: group, channel: 'production', runtime: 'runtime-1' } });
test('late activation matches only the downloaded and unapplied update', () => {
  const c = campaign(), ctx = context(); assert.ok(eligible(c, ctx));
  for (const patch of [{ downloadedId: group }, { runningId: id }, { pending: false }, { enabled: false }, { channel: 'test' }, { runtime: 'other' }, { downloadedId: null }]) assert.equal(eligible(c, { ...ctx, ota: { ...ctx.ota, ...patch } }), false);
  for (const patch of [{ platform: 'web' }, { room: 0 }, { variant: 'test' }, { now: Date.parse(c.expires_at) }, { now: Date.parse(c.starts_at) - 1 }]) assert.equal(eligible(c, { ...ctx, ...patch }), false);
});
test('general notices work without native OTA; unsupported payloads never render', () => {
  const c = { ...campaign(), kind: 'info_notice', platforms: ['web'], payload: { title: '점검 안내' } };
  assert.ok(eligible(c, { ...context(), platform: 'web', ota: { ...context().ota, enabled: false } }));
  assert.ok(decodeCampaign(c)); assert.equal(decodeCampaign({ ...c, schema_version: 2 }), null);
  assert.equal(decodeCampaign({ ...c, payload: { title: 5 } }), null);
  assert.equal(eligible({ ...c, min_capability_version: 2 }, { ...context(), platform: 'web' }), false);
  assert.equal(orderCampaigns([c, campaign()])[0].kind, 'update_ready');
});
test('history survives restart, isolates users and rooms, and serializes concurrent completion', async () => {
  const stored = new Map(), storage = { getItem: async k => stored.get(k) ?? null, setItem: async (k, v) => { await Promise.resolve(); stored.set(k, v); } };
  const h = createToastHistory(storage, () => id);
  assert.equal(await h.installationId(), id);
  await Promise.all([h.complete('1:user', id, now + 10000), h.complete('1:user', group, now + 10000)]);
  const restarted = createToastHistory(storage, () => group);
  assert.equal(await restarted.installationId(), id);
  assert.equal((await restarted.load('1:user')).size, 2);
  assert.equal((await restarted.load('0:user')).size, 0); assert.equal((await restarted.load('1:other')).size, 0);
});
test('preview materializes stable IDs and times; update payload has no custom message', () => {
  const v = prepare({ roomId: 1, kind: 'info_notice', appVariant: 'production', payload: { title: '안내' } }, now);
  const created = parseInput({ ...v, action: 'create' }, now + 5000);
  assert.equal(created.requestId, v.requestId); assert.equal(created.startsAt, v.startsAt);
  assert.equal(Date.parse(created.expiresAt) - Date.parse(created.startsAt), 86400000);
  assert.throws(() => prepare({ roomId: 1, kind: 'update_ready', appVariant: 'production', payload: { ...campaign().payload, projectId: '973ad697-739b-49cc-bd6f-fbef67a1059e', sha: 'a'.repeat(40), message: 'custom' } }, now));
  for (const patch of [{ userIds: [] }, { roomId: '1' }, { expiresAt: new Date(now + 31 * 86400000).toISOString() }, { payload: { title: 'x'.repeat(61) } }]) assert.throws(() => parseInput({ ...created, ...patch }, now));
});
test('admin request uses only toast endpoint and reuses request identity', async () => {
  const input = prepare({ roomId: 1, kind: 'info_notice', appVariant: 'production', payload: { title: '안내' } });
  const config = { token: 'x'.repeat(64) }; let body;
  const response = await request(input, config, async (url, options) => {
    assert.ok(url.endsWith('/admin-toasts')); assert.equal(options.redirect, 'error');
    assert.equal(options.headers['x-admin-toast-token'], config.token); body = JSON.parse(options.body);
    return { status: 200, json: async () => ({ status: 'preview' }) };
  });
  assert.equal(response.httpStatus, 200); assert.equal(body.requestId, input.requestId);
});
test('deployment resolution refuses mismatched EAS IDs, runtime and failed publishes', () => {
  const record = { status: 'published', channel: 'production', platform: 'android', sha: 'a'.repeat(40), runtimeVersion: 'r', apkTag: 'v1.0.2', updateId: id, groupId: group };
  const row = { id, group, platform: 'android', runtimeVersion: 'r' }, plan = { mode: 'update', sha: record.sha, runtimeVersion: 'r', baseline: { tag: record.apkTag } };
  assert.equal(deploymentTarget(record, [row], plan).updateId, id);
  assert.throws(() => deploymentTarget({ ...record, status: 'failed' }, [row], plan));
  assert.throws(() => deploymentTarget(record, [{ ...row, group: id }], plan));
  assert.throws(() => deploymentTarget(record, [{ ...row, runtimeVersion: 'other' }], plan));
});
