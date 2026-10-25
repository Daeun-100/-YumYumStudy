// Explicit integration test. Creates 2 anonymous users and short study sessions.
// Never saves or logs authentication tokens; test users/records are retained.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';

if (!process.argv.includes('--run')) {
  console.log('Run: node --env-file=.env.local scripts/check-study-core.mjs --run');
  console.log('Creates two test users and leaves their completed test records in Supabase.');
  process.exit(0);
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key?.startsWith('sb_publishable_')) throw new Error('Supabase configuration missing');
const makeClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const a = makeClient();
const b = makeClient();
const unauthenticated = makeClient();
const testRun = randomUUID();
const running = new Set();
const events = [];
let channel;
let stage = 'initialization';

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(15000));
  if (error) throw new Error(`${name}: ${error.code || 'network failure'}`);
  return data;
}
async function denied(promise, description) {
  const { error } = await promise;
  assert.ok(error, description);
  assert.ok(['42501', 'PGRST301', 'PGRST302'].includes(error.code), `${description}: unexpected error ${error.code}`);
}
async function waitFor(predicate) {
  const end = Date.now() + 20000;
  while (!predicate()) {
    if (Date.now() >= end) throw new Error(`Realtime event timeout (received ${events.length} events)`);
    await delay(100);
  }
}

try {
  await denied(unauthenticated.rpc('get_room'), 'No-session RPC must be denied');
  await denied(unauthenticated.from('study_sessions').select('id').limit(1), 'No-session table read must be denied');
  console.log('PASS: requests without user authentication denied');

  const identities = await Promise.all([a, b].map(async (client) => {
    const { data, error } = await client.auth.signInAnonymously({ options: { data: { study_core_test: testRun } } });
    if (error || !data.user?.is_anonymous) throw new Error('Test identity creation failed');
    return data.user.id;
  }));
  console.log(`Test UIDs: ${identities.join(', ')}`);
  console.log(`Test run: ${testRun}`);
  const [profileA, profileB] = await Promise.all([rpc(a, 'ensure_profile'), rpc(b, 'ensure_profile')]);
  assert.equal(profileA.id, identities[0]);
  assert.equal(profileB.id, identities[1]);
  assert.deepEqual(await rpc(a, 'ensure_profile'), profileA);
  assert.deepEqual(await rpc(a, 'get_goals'), [null, null, null, null, null, null, null]);
  console.log('PASS: fixed-room profile creation is idempotent; unset goals remain null');

  await denied(a.from('profiles').update({ display_name: 'must-not-write' }).eq('id', identities[1]), 'Other profile write must be denied');
  await denied(a.from('profiles').insert({ id: identities[1], display_name: 'must-not-write' }), 'Profile impersonation must be denied');
  await denied(a.from('study_sessions').insert({ user_id: identities[0], started_at: '2000-01-01T00:00:00Z' }), 'Direct session/time write must be denied');
  await denied(a.from('goal_versions').insert({ user_id: identities[1], effective_date: '2026-10-26', weekday_minutes: [1, 1, 1, 1, 1, 1, 1] }), 'Other goals write must be denied');
  await denied(a.from('study_start_requests').select('*'), 'Idempotency mapping is not a public table');
  console.log('PASS: direct writes, impersonation and private request mapping reads denied');

  stage = 'realtime subscription';
  channel = b.channel(`core-test-${testRun}`).on('postgres_changes', {
    event: '*', schema: 'public', table: 'study_sessions',
  }, (payload) => events.push(payload));
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Realtime subscribe timeout')), 20000);
    channel.subscribe((status) => {
      console.log(`Realtime status: ${status}`);
      if (status === 'SUBSCRIBED') { clearTimeout(timeout); resolve(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timeout); reject(new Error(`Realtime ${status}`)); }
    });
  });
  const requestA = randomUUID();
  const requestB = randomUUID();
  const [first, concurrent] = await Promise.all([
    rpc(a, 'start_study', { p_request_id: requestA }),
    rpc(a, 'start_study', { p_request_id: requestB }),
  ]);
  running.add(first.data.id);
  running.add(concurrent.data.id);
  assert.equal(first.data.id, concurrent.data.id);
  assert.equal(first.data.endedAt, null);
  assert.equal((await rpc(a, 'start_study', { p_request_id: requestA })).data.id, first.data.id);
  const active = await a.from('study_sessions').select('id').eq('user_id', identities[0]).is('ended_at', null);
  assert.ifError(active.error);
  assert.equal(active.data.length, 1);
  stage = 'start and ownership checks';
  const room = await rpc(b, 'get_room');
  assert.equal(room.data.find((member) => member.profile.id === identities[0]).activeSession.id, first.data.id);
  await denied(b.rpc('stop_study', { p_session_id: first.data.id }), 'Other user stop must be denied');
  console.log('PASS: concurrent/retried starts create one session; friend reads active session; other-user stop denied');

  const [stopped, repeatedStop] = await Promise.all([
    rpc(a, 'stop_study', { p_session_id: first.data.id }),
    rpc(a, 'stop_study', { p_session_id: first.data.id }),
  ]);
  running.delete(first.data.id);
  assert.ok(stopped.data.endedAt);
  assert.equal(stopped.data.endedAt, repeatedStop.data.endedAt);
  assert.equal((await rpc(b, 'get_room')).data.find((member) => member.profile.id === identities[0]).activeSession, null);
  const second = await rpc(a, 'start_study', { p_request_id: randomUUID() });
  running.add(second.data.id);
  assert.notEqual(second.data.id, first.data.id);
  const delayed = await rpc(a, 'start_study', { p_request_id: requestB });
  assert.equal(delayed.data.id, first.data.id);
  assert.equal(delayed.data.endedAt, stopped.data.endedAt);
  assert.equal((await rpc(a, 'get_today')).data.activeSession.id, second.data.id);
  await rpc(a, 'stop_study', { p_session_id: second.data.id });
  running.delete(second.data.id);
  const today = await rpc(a, 'get_today');
  assert.equal(today.data.activeSession, null);
  assert.equal(today.data.day.runningSeconds, 0);
  assert.equal(today.data.day.attendance, 'pending');
  assert.equal(today.data.day.goalMinutes, null);
  const history = await rpc(a, 'get_history', { p_from: today.data.day.studyDate, p_to: today.data.day.studyDate });
  assert.equal(history.data[0].closedSeconds, today.data.day.closedSeconds);
  console.log('PASS: repeated stop retains timestamp; delayed start retry cannot create a new session');
  console.log('PASS: today/history agree and policy-dependent values remain pending');
  stage = 'realtime delivery';
  await waitFor(() => events.some((event) => event.eventType === 'INSERT' && event.new.id === first.data.id));
  await waitFor(() => events.some((event) => event.eventType === 'UPDATE' && event.new.id === first.data.id && event.new.ended_at));
  console.log('PASS: friend received realtime INSERT and UPDATE');
} catch (error) {
  console.error(`${stage}: ${error instanceof Error ? error.message : 'Core integration test failed'}`);
  process.exitCode = 1;
} finally {
  // Stop only sessions created by this test. Keep users/records for inspection.
  for (const sessionId of running) {
    try { await rpc(a, 'stop_study', { p_session_id: sessionId }); }
    catch { console.error('Test session cleanup failed; inspect test account.'); process.exitCode = 1; }
  }
  if (channel) await b.removeChannel(channel);
  for (const client of [a, b, unauthenticated]) await client.removeAllChannels();
}
