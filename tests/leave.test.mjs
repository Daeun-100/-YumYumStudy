import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeLeaveStatus } from '../src/data/decode.ts';

const grant = { id: 'grant-a', earningWeek: '2026-10-26', earnedAt: '2026-10-31T07:00:00+09:00', expiresAt: '2026-11-16T06:00:00+09:00' };
test('leave data retains earning week and fixed Monday 06:00 expiry', () => {
  assert.deepEqual(decodeLeaveStatus({ availableCount: 1, grants: [grant] }), { availableCount: 1, grants: [grant] });
  assert.deepEqual(decodeLeaveStatus({ availableCount: 0, grants: [grant] }).grants, [grant]);
  assert.deepEqual(decodeLeaveStatus({ availableCount: 0, grants: [] }), { availableCount: 0, grants: [] });
});
test('reject duplicate weeks, impossible balance, wrong week and expiry boundaries', () => {
  for (const data of [
    { availableCount: 2, grants: [grant] },
    { availableCount: 1, grants: [grant, grant] },
    { availableCount: 1, grants: [{ ...grant, earningWeek: '2026-10-27' }] },
    { availableCount: 1, grants: [{ ...grant, earnedAt: '2026-10-26T05:59:59+09:00' }] },
    { availableCount: 1, grants: [{ ...grant, expiresAt: '2026-11-16T05:59:59+09:00' }] },
    { availableCount: 1, grants: null },
  ]) assert.throws(() => decodeLeaveStatus(data));
});
