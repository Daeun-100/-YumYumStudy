import test from 'node:test';
import assert from 'node:assert/strict';
import { celebrationForToday, createDailyCelebrationTracker, goalReached, weekDates } from '../src/features/celebrations/model.ts';

const uid = 'owner';
const date = '2026-10-31';
const record = (studyDate, patch = {}) => ({ studyDate, goalMinutes: 120, closedSeconds: 7200, runningSeconds: 0, attendance: 'present', isRestDay: false, goalAchieved: true, ...patch });
const today = (patch = {}) => ({ serverNow: '2026-10-31T10:00:00+09:00', data: { profile: { id: uid, displayName: '나' }, activeSession: null, day: record(date), ...patch } });
const history = weekDates(date).slice(0, 6).map(d => record(d));
const grant = { id: 'reward', kind: 'reward', earningWeek: '2026-10-26', earnedAt: '2026-10-31T09:00:00+09:00', expiresAt: '2026-11-16T06:00:00+09:00', status: 'AVAILABLE', scheduledDate: null };
const leave = (grants = []) => ({ revision: 1, availableCount: grants.length, grants });
const make = (snapshot = today(), days = history, grants = []) => celebrationForToday(uid, date, snapshot, days, leave(grants));

test('current-day achievement chooses exactly one notice, adding reward only with a real grant', () => {
  assert.equal(make().reward, false);
  const notice = make(today(), history, [grant]);
  assert.equal(notice.reward, true);
  assert.equal(notice.days.length, 7);
  assert.equal(notice.todayIndex, 5);
  assert.equal(notice.days[6].achieved, false);
});
test('rest, unset, incomplete and another owner do not create a notice', () => {
  for (const patch of [{ goalMinutes: null }, { goalMinutes: 0 }, { closedSeconds: 7199 }]) assert.equal(make(today({ day: record(date, patch) })), null);
  assert.equal(make(today({ profile: { id: 'other' } })), null);
  assert.equal(goalReached(record(date, { closedSeconds: 7100, runningSeconds: 100 })), true);
});
test('6am rollover excludes past-day goals, including a recovered reward', () => {
  assert.equal(celebrationForToday(uid, '2026-11-01', today(), history, leave([grant])), null);
  assert.equal(celebrationForToday(uid, date, { ...today(), serverNow: '2026-11-01T06:00:00+09:00' }, history, leave([grant])), null);
});
test('free, admin, expired and earlier-day rewards never create a reward-only notice', () => {
  for (const patch of [{ kind: 'free' }, { kind: 'admin', earningWeek: null, expiresAt: null }, { status: 'EXPIRED' }, { earnedAt: '2026-10-30T12:00:00+09:00' }, { earningWeek: '2026-10-19' }]) assert.equal(make(today(), history, [{ ...grant, ...patch }]).reward, false);
});
test('leave day still gets a goal stamp but does not earn a reward', () => {
  const notice = make(today({ day: record(date, { attendance: 'leave' }) }), history, [grant]);
  assert.equal(notice.reward, false);
  assert.equal(notice.days[5].achieved, true);
  assert.equal(notice.days[5].leave, true);
});
test('a missed Wednesday stays empty; the sixth eligible day can be Sunday', () => {
  const sunday = '2026-11-01';
  const week = weekDates(sunday).map((d, i) => record(d, i === 2 ? { closedSeconds: 0, goalAchieved: false } : {}));
  const snapshot = { ...today(), serverNow: '2026-11-01T10:00:00+09:00', data: { ...today().data, day: record(sunday) } };
  const notice = celebrationForToday(uid, sunday, snapshot, week, leave([{ ...grant, earnedAt: '2026-11-01T09:00:00+09:00' }]));
  assert.equal(notice.reward, true);
  assert.equal(notice.days[2].achieved, false);
  assert.equal(notice.todayIndex, 6);
  assert.deepEqual(weekDates(sunday), weekDates(date));
});
test('seventh day celebrates its goal without reissuing the sixth-day reward', () => {
  const sunday = '2026-11-01';
  const snapshot = { ...today(), serverNow: '2026-11-01T10:00:00+09:00', data: { ...today().data, day: record(sunday) } };
  assert.equal(celebrationForToday(uid, sunday, snapshot, weekDates(sunday).map(d => record(d)), leave([grant])).reward, false);
});
test('today replaces stale history; future records cannot fill the next stamp', () => {
  const notice = make(today(), [...history.filter(d => d.studyDate !== date), record('2026-11-01')], [grant]);
  assert.equal(notice.days[5].achieved, true);
  assert.equal(notice.days[6].achieved, false);
});
test('date marker survives reload, stays scoped, and does not hold a notification archive', async () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const first = createDailyCelebrationTracker(storage);
  assert.equal(await first.wasStarted(uid, 1, date), false);
  await first.start(uid, 1, date);
  const restarted = createDailyCelebrationTracker(storage);
  assert.equal(await restarted.wasStarted(uid, 1, date), true);
  assert.equal(await restarted.wasStarted('other', 1, date), false);
  assert.equal(await restarted.wasStarted(uid, 0, date), false);
  assert.equal(await restarted.wasStarted(uid, 1, '2026-11-01'), false);
  await restarted.start(uid, 1, '2026-11-01');
  assert.deepEqual([...values.values()], ['2026-11-01']);
});
test('storage failure still suppresses repeats in the same run', async () => {
  const tracker = createDailyCelebrationTracker({ getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('full'); } });
  assert.equal(await tracker.wasStarted(uid, 1, date), false);
  await tracker.start(uid, 1, date);
  assert.equal(await tracker.wasStarted(uid, 1, date), true);
});
