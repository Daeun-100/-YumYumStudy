import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeLeaveStatus } from '../src/data/decode.ts';
import { leaveGrantView, reservationReason } from '../src/features/leave/model.ts';
import { leaveRefreshKey } from '../src/lib/leave-refresh.ts';

const earnedAt = '2026-10-28T12:00:00+09:00';
const admin = { id: 'admin', kind: 'admin', earningWeek: null, expiresAt: null, earnedAt, approvedAt: earnedAt, status: 'USED', scheduledDate: '2026-10-21' };
const regular = { id: 'reward', kind: 'reward', earningWeek: '2026-10-19', earnedAt: '2026-10-24T12:00:00+09:00', expiresAt: '2026-11-09T06:00:00+09:00', status: 'AVAILABLE', scheduledDate: null };

test('admin grants accept retroactive application with actual approval time and no week or expiry', () => {
  const data = decodeLeaveStatus({ revision: 4, availableCount: 1, grants: [
    regular, admin,
    { ...admin, id: 'today', scheduledDate: '2026-10-28' },
    { ...admin, id: 'future', status: 'SCHEDULED', scheduledDate: '2026-10-30' },
  ] });
  assert.equal(data.availableCount, 1);
  assert.equal(data.grants.length, 4);
  assert.deepEqual(data.grants[1], admin);
  assert.deepEqual(leaveGrantView(data.grants[1]), { id: 'admin', kind: 'admin', state: 'used', earned: '2026-10-28', expires: null, date: '2026-10-21' });
});

test('reject unapplied admin balance, malformed dates and contradictory metadata', () => {
  for (const patch of [
    { status: 'AVAILABLE', scheduledDate: null }, { status: 'EXPIRED', scheduledDate: null },
    { scheduledDate: null }, { scheduledDate: '2026-02-30' },
    { earningWeek: '2026-10-26' }, { expiresAt: '2026-11-02T06:00:00+09:00' },
    { approvedAt: null }, { approvedAt: '2026-10-28T11:59:59+09:00' },
    { kind: 'reward' }, { kind: 'free' },
  ]) assert.throws(() => decodeLeaveStatus({ revision: 0, availableCount: 0, grants: [{ ...admin, ...patch }] }));
  assert.throws(() => decodeLeaveStatus({ revision: 0, availableCount: 1, grants: [admin] }));
  assert.throws(() => decodeLeaveStatus({ revision: 0, availableCount: 0, grants: [admin, { ...admin, id: 'duplicate-day' }] }));
});

test('private operating reason is never included in decoded or presentation data', () => {
  const decoded = decodeLeaveStatus({ revision: 0, availableCount: 0, grants: [{ ...admin, reason: 'private operating note' }] }).grants[0];
  assert.equal('reason' in decoded, false);
  assert.equal('reason' in leaveGrantView(decoded), false);
});

test('admin reservations cannot be moved or selected and still occupy their dates', () => {
  const today = '2026-10-28';
  const now = Date.parse(earnedAt);
  const future = { ...admin, status: 'SCHEDULED', scheduledDate: '2026-10-30' };
  assert.match(reservationReason('2026-10-31', today, [future, regular], now, admin.id), /관리자/);
  assert.match(reservationReason('2026-10-30', today, [future, regular], now), /이미/);
  assert.match(reservationReason('2026-10-31', today, [future], now), /없어요/);
  assert.equal(reservationReason('2026-10-31', today, [future, regular], now), null);
});

test('non-expiring admin reservation refreshes at the study day boundary', () => {
  const today = { serverNow: '2026-10-29T05:59:59+09:00', data: { day: { studyDate: '2026-10-28', attendance: 'present', goalMinutes: null, closedSeconds: 0, runningSeconds: 0 }, activeSession: null } };
  const leave = { data: { revision: 0, availableCount: 0, grants: [{ ...admin, status: 'SCHEDULED', scheduledDate: '2026-10-29' }] } };
  const before = leaveRefreshKey(today, Date.parse(today.serverNow), leave);
  const at = leaveRefreshKey(today, Date.parse('2026-10-29T06:00:00+09:00'), leave);
  assert.equal(before.endsWith(':admin'), false);
  assert.equal(at.endsWith(':admin'), true);
  leave.data.grants[0].status = 'USED';
  assert.equal(leaveRefreshKey(today, Date.parse('2026-10-29T06:00:00+09:00'), leave).endsWith(':admin'), false);
});
