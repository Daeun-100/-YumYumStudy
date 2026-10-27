import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeLeaveStatus } from '../src/data/decode.ts';

const grant = { status: 'AVAILABLE', scheduledDate: null, id: 'grant-a', earningWeek: '2026-10-26', earnedAt: '2026-10-31T07:00:00+09:00', expiresAt: '2026-11-16T06:00:00+09:00' };
test('leave data retains earning week and fixed Monday 06:00 expiry', () => {
  assert.deepEqual(decodeLeaveStatus({ revision: 0, availableCount: 1, grants: [grant] }), { revision: 0, availableCount: 1, grants: [grant] });
  assert.throws(() => decodeLeaveStatus({ revision: 0, availableCount: 0, grants: [grant] }));
  assert.deepEqual(decodeLeaveStatus({ revision: 0, availableCount: 0, grants: [] }), { revision: 0, availableCount: 0, grants: [] });
});
test('reject duplicate weeks, impossible balance, wrong week and expiry boundaries', () => {
  for (const data of [
    { revision: 0, availableCount: 2, grants: [grant] },
    { revision: 0, availableCount: 1, grants: [grant, grant] },
    { revision: 0, availableCount: 1, grants: [{ ...grant, earningWeek: '2026-10-27' }] },
    { revision: 0, availableCount: 1, grants: [{ ...grant, earnedAt: '2026-10-26T05:59:59+09:00' }] },
    { revision: 0, availableCount: 1, grants: [{ ...grant, expiresAt: '2026-11-16T05:59:59+09:00' }] },
    { revision: 0, availableCount: 1, grants: null },
  ]) assert.throws(() => decodeLeaveStatus(data));
});

test('scheduled, used and expired grants never contribute to available balance', () => {
  for (const status of ['SCHEDULED', 'USED', 'EXPIRED']) {
    const item = { ...grant, status, scheduledDate: status === 'EXPIRED' ? null : '2026-11-02' };
    assert.equal(decodeLeaveStatus({ revision: 0, availableCount: 0, grants: [item] }).grants[0].status, status);
    assert.throws(() => decodeLeaveStatus({ revision: 0, availableCount: 1, grants: [item] }));
  }
});
test('reject unknown states and contradictory reservation data', () => {
  for (const change of [
    { status: 'UNKNOWN' }, { status: 'SCHEDULED' }, { status: 'USED' },
    { scheduledDate: '2026-11-02' },
    { status: 'SCHEDULED', scheduledDate: '2026-11-16' },
    { status: 'SCHEDULED', scheduledDate: '2026-10-30' },
  ]) assert.throws(() => decodeLeaveStatus({ revision: 0, availableCount: 0, grants: [{ ...grant, ...change }] }));
});
