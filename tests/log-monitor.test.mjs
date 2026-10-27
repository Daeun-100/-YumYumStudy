import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findingsFor, isScheduledSlot, parseSummaries, windowFor } from '../supabase/functions/log-monitor/policy.ts';

const normal = { source: 'edge_logs', requests: 5000, responses: 5000, server_errors: 0, peak_second: 10, peak_minute: 500 };

test('runs only at the seven requested KST times, never at :00/:20 or 18:10', () => {
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute++) {
      const date = new Date(`2026-10-27T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`);
      assert.equal(isScheduledSlot(date), [15, 16, 17, 19, 20, 21, 22].includes(hour) && minute === 10);
    }
  }
  assert.deepEqual(windowFor(new Date('2026-10-27T15:10:00+09:00')), { start: '2026-10-27T06:00:00.000Z', end: '2026-10-27T06:10:00.000Z' });
});

test('normal traffic is silent and error policy requires BOTH minimum count and rate', () => {
  assert.deepEqual(findingsFor([normal]), []);
  assert.deepEqual(findingsFor([{ ...normal, responses: 100, server_errors: 19 }]), []);
  assert.deepEqual(findingsFor([{ ...normal, server_errors: 20 }]), []);
  assert.equal(findingsFor([{ ...normal, responses: 400, server_errors: 20 }]).length, 1);
  assert.equal(findingsFor([{ ...normal, peak_second: 1000 }]).length, 1);
  assert.equal(findingsFor([{ ...normal, peak_minute: 3000 }]).length, 1);
});

test('sources are not summed together and malformed responses cannot appear healthy', () => {
  assert.deepEqual(findingsFor([{ ...normal, peak_second: 600 }, { ...normal, source: 'function_edge_logs', peak_second: 600 }]), []);
  assert.throws(() => parseSummaries(undefined));
  assert.throws(() => parseSummaries([{ ...normal, server_errors: 'broken' }]));
  assert.throws(() => parseSummaries([{ ...normal, responses: 0, server_errors: 1 }]));
  assert.throws(() => parseSummaries([normal, normal]));
  assert.deepEqual(parseSummaries([{ ...normal, requests: '5000' }]), [normal]);
  assert.deepEqual(parseSummaries([]), []);
});

test('HTTP handler authenticates, skips other times, and sends only findings or monitoring failures', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-27T06:10:01Z') });
  const previousDeno = globalThis.Deno;
  const previousFetch = globalThis.fetch;
  let handler;
  const env = { MONITOR_CRON_SECRET: 'test-only-secret', MONITOR_MANAGEMENT_TOKEN: 'test-only-token', SUPABASE_URL: 'https://example.supabase.co', DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/test/test' };
  globalThis.Deno = { env: { get: (name) => env[name] }, serve: (value) => { handler = value; } };
  let rows = [normal];
  let queryFails = false;
  const messages = [];
  const queries = [];
  globalThis.fetch = async (url, options) => {
    if (new URL(url).hostname === 'discord.com') {
      messages.push(JSON.parse(options.body));
      return new Response(null, { status: 204 });
    }
    queries.push(new URL(url));
    return queryFails ? new Response(null, { status: 403 }) : Response.json({ result: rows });
  };
  const invoke = (body = {}, authorized = true) => handler(new Request('https://example.test', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: 'Bearer test-only-secret' } : {}) }, body: JSON.stringify(body),
  }));
  try {
    const entrypoint = new URL('../supabase/functions/log-monitor/index.ts', import.meta.url);
    await import(entrypoint.href);
    assert.equal((await invoke({}, false)).status, 401);
    assert.equal(queries.length, 0);
    assert.equal((await (await invoke()).json()).status, 'clear');
    assert.equal(messages.length, 0);
    assert.equal(queries[0].searchParams.get('iso_timestamp_start'), '2026-10-27T06:00:00.000Z');
    assert.equal(queries[0].searchParams.get('iso_timestamp_end'), '2026-10-27T06:10:00.000Z');
    rows = [{ ...normal, peak_second: 1000, peak_minute: 1000 }];
    assert.equal((await (await invoke({ dry_run: true })).json()).notified, false);
    assert.equal(messages.length, 0);
    assert.equal((await (await invoke()).json()).notified, true);
    assert.equal(messages.length, 1);
    assert.deepEqual(messages[0].allowed_mentions.parse, []);
    const count = queries.length;
    assert.equal((await (await invoke({ end: '2026-10-27T06:00:00Z' })).json()).status, 'skipped_outside_schedule');
    assert.equal(queries.length, count);
    rows = [];
    assert.equal((await (await invoke()).json()).status, 'no_observations');
    assert.equal(messages.length, 1);
    queryFails = true;
    assert.equal((await invoke({ dry_run: true })).status, 502);
    assert.equal(messages.length, 1);
    assert.equal((await invoke()).status, 502);
    assert.equal(messages.length, 2);
    assert.match(messages[1].content, /감시 실패/);
  } finally {
    globalThis.Deno = previousDeno;
    globalThis.fetch = previousFetch;
  }
});
