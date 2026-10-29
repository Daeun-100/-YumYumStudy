import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeDay, decodeWatermelonBalance } from '../src/data/decode.ts';
import { reservationReason } from '../src/features/leave/model.ts';
import { recordQueryVersion } from '../src/lib/record-query-version.ts';

const sunday = { studyDate: '2026-10-25', closedSeconds: 180, runningSeconds: 0, goalMinutes: 3, attendance: 'present', isRestDay: false, goalAchieved: true };
const week = Array.from({ length: 7 }, (_, i) => ({ ...sunday, studyDate: `2026-10-${19 + i}` }));
const grant = { id: 'available', kind: 'reward', status: 'AVAILABLE', scheduledDate: null, earningWeek: '2026-10-12', earnedAt: '2026-10-17T06:03:00+09:00', expiresAt: '2026-11-02T06:00:00+09:00' };
const now = Date.parse('2026-10-25T12:00:00+09:00');

test('wallet reads both currencies and rejects negative, fractional or unsafe balances', () => {
  assert.deepEqual(decodeWatermelonBalance({ normalBalance: 6, superBalance: 1 }), { normalBalance: 6, superBalance: 1 });
  assert.deepEqual(decodeWatermelonBalance({ normalBalance: 0, superBalance: 0 }), { normalBalance: 0, superBalance: 0 });
  for (const value of [-1, 0.5, '3', null, undefined, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => decodeWatermelonBalance({ normalBalance: value, superBalance: 0 }));
    assert.throws(() => decodeWatermelonBalance({ normalBalance: 0, superBalance: value }));
  }
});

test('gold accepts server Sunday markers, rejects malformed fields and supports older responses', () => {
  assert.deepEqual(decodeDay(sunday), sunday);
  assert.equal(decodeDay({ ...sunday, superWatermelon: true }).superWatermelon, true);
  assert.equal(decodeDay({ ...sunday, superWatermelon: false }).superWatermelon, false);
  for (const value of [null, 1, 'true', {}]) assert.throws(() => decodeDay({ ...sunday, superWatermelon: value }));
  assert.throws(() => decodeDay({ ...sunday, studyDate: '2026-10-24', superWatermelon: true }));
});

test('Sunday all-seven completion is protected before or after server award lookup', () => {
  assert.match(reservationReason(sunday.studyDate, sunday.studyDate, [grant], now, null, week), /목표 달성 보상/);
  assert.match(reservationReason(sunday.studyDate, sunday.studyDate, [grant], now, null, [{ ...sunday, superWatermelon: true }]), /목표 달성 보상/);
  // Six earlier achievements with a not-yet-achieved Sunday still permit rest.
  const partial = week.map((day, i) => i === 6 ? { ...day, closedSeconds: 179, goalAchieved: false } : day);
  assert.equal(reservationReason(sunday.studyDate, sunday.studyDate, [grant], now, null, partial), null);
  // A duplicate day cannot manufacture the seventh achievement.
  assert.equal(reservationReason(sunday.studyDate, sunday.studyDate, [grant], now, null, [...partial, partial[0]]), null);
});

test('gold confirmation invalidates today history without per-second invalidation', () => {
  const snapshot = { day: sunday, activeSession: null };
  const version = data => recordQueryVersion(data, '2026-10-19', '2026-10-25');
  assert.notEqual(version(snapshot), version({ ...snapshot, day: { ...sunday, superWatermelon: true } }));
  assert.equal(version(snapshot), version({ ...snapshot, day: { ...sunday, runningSeconds: 60 } }));
});
