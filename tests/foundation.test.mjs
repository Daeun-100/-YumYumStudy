import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthBootstrap } from '../src/lib/identity-core.ts';
import { getStudyDate, getStudyDayBounds, secondsInStudyDay } from '../src/lib/study-day.ts';
import { createServerClock } from '../src/lib/clock.ts';
import { validateGoalWeek } from '../src/lib/contracts.ts';
import { validateSupabaseConfig } from '../src/lib/config.ts';

function identityFixture({ session = null, sessionError = null, userError = null, previous = null, createError = null } = {}) {
  let uid = previous;
  let stored = session;
  let creates = 0;
  const ensure = createAuthBootstrap({
    getSession: async () => ({ data: { session: stored }, error: sessionError }),
    getUser: async () => ({ data: { user: stored?.user ?? null }, error: userError }),
    signInAnonymously: async () => {
      creates++;
      if (createError) return { data: { user: null }, error: createError };
      stored = { user: { id: 'new-uid' } };
      return { data: { user: stored.user }, error: null };
    },
  }, { read: async () => uid, save: async (value) => { uid = value; } });
  return { ensure, creates: () => creates };
}

test('concurrent first launch shares one signup, next launch restores the same UID', async () => {
  const fixture = identityFixture();
  const first = fixture.ensure();
  assert.equal(first, fixture.ensure());
  assert.deepEqual(await Promise.all([first, fixture.ensure()]), ['new-uid', 'new-uid']);
  assert.equal(await fixture.ensure(), 'new-uid');
  assert.equal(fixture.creates(), 1);
});

test('existing session verifies and restores without anonymous signup', async () => {
  const fixture = identityFixture({ session: { user: { id: 'old-uid' } }, previous: 'old-uid' });
  assert.equal(await fixture.ensure(), 'old-uid');
  assert.equal(fixture.creates(), 0);
});

test('session read errors and server verification errors never generate a replacement UID', async () => {
  for (const options of [
    { sessionError: new TypeError('offline') },
    { session: { user: { id: 'old-uid' } }, userError: new TypeError('offline') },
    { session: { user: { id: 'old-uid' } }, userError: { status: 401 } },
    { previous: 'old-uid' },
    { session: { user: { id: 'other-uid' } }, previous: 'old-uid' },
  ]) {
    const fixture = identityFixture(options);
    await assert.rejects(fixture.ensure());
    assert.equal(fixture.creates(), 0);
  }
});

test('failed bootstrap can be retried instead of leaving a permanently rejected promise', async () => {
  const fixture = identityFixture({ createError: new TypeError('offline') });
  await assert.rejects(fixture.ensure(), (error) => error.code === 'NETWORK');
  await assert.rejects(fixture.ensure(), (error) => error.code === 'NETWORK');
  assert.equal(fixture.creates(), 2);
});

test('inaccessible persistent storage stops before creating any anonymous user', async () => {
  let creates = 0;
  const ensure = createAuthBootstrap({
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    signInAnonymously: async () => { creates++; return { data: { user: null }, error: null }; },
  }, { read: async () => { throw new Error('storage blocked'); }, save: async () => {} });
  await assert.rejects(ensure());
  assert.equal(creates, 0);
});

test('study date changes exactly at 06:00 KST, regardless of host timezone', () => {
  assert.equal(getStudyDate('2026-10-26T05:59:59+09:00'), '2026-10-25');
  assert.equal(getStudyDate('2026-10-26T06:00:00+09:00'), '2026-10-26');
  assert.equal(getStudyDate('2026-10-25T21:00:00Z'), '2026-10-26');
  assert.equal(new Date(getStudyDayBounds('2026-10-26').startMs).toISOString(), '2026-10-25T21:00:00.000Z');
});

test('split overnight and multi-day sessions, excluding portions outside each day', () => {
  const start = '2026-10-26T05:30:00+09:00';
  const end = '2026-10-26T06:30:00+09:00';
  assert.equal(secondsInStudyDay(start, end, '2026-10-25'), 1800);
  assert.equal(secondsInStudyDay(start, end, '2026-10-26'), 1800);
  assert.equal(secondsInStudyDay(start, end, '2026-10-27'), 0);
  assert.equal(secondsInStudyDay(start, '2026-10-28T06:30:00+09:00', '2026-10-26'), 86400);
  assert.equal(secondsInStudyDay(end, start, '2026-10-26'), 0);
  assert.equal(secondsInStudyDay('2026-10-26T06:00:00.900+09:00', '2026-10-26T06:00:01.800+09:00', '2026-10-26'), 0);
  assert.throws(() => getStudyDayBounds('2026-02-30'));
  assert.throws(() => getStudyDayBounds('2026-2-3'));
  assert.throws(() => getStudyDate('invalid'));
});

test('display clock follows monotonic elapsed time, clamps backwards movement and reanchors', () => {
  let elapsed = 100;
  const now = createServerClock('2026-10-26T01:00:00Z', () => elapsed);
  const baseline = Date.parse('2026-10-26T01:00:00Z');
  elapsed = 2100;
  assert.equal(now(), baseline + 2000);
  elapsed = 0;
  assert.equal(now(), baseline);
  const corrected = createServerClock('2026-10-26T02:00:00Z', () => elapsed);
  assert.equal(corrected(), Date.parse('2026-10-26T02:00:00Z'));
  assert.throws(() => createServerClock('invalid'));
});

test('validate seven goals and reject absent or unsafe project configuration', () => {
  validateGoalWeek([null, 0, 60, null, 30, 120, null]);
  for (const value of [[], new Array(7), [1, 2, 3, 4, 5, 6, -1], [1, 2, 3, 4, 5, 6, 1.5]]) assert.throws(() => validateGoalWeek(value));
  for (const url of [undefined, 'http://test.supabase.co', 'https://supabase.co.attacker.com', 'https://user:secret@test.supabase.co', 'https://test.supabase.co/not-root']) {
    assert.throws(() => validateSupabaseConfig(url, 'sb_publishable_test'), (error) => error.code === 'NOT_CONFIGURED');
  }
  assert.deepEqual(validateSupabaseConfig('https://test.supabase.co', 'sb_publishable_test'), { url: 'https://test.supabase.co', key: 'sb_publishable_test' });
});
