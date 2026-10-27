import test from 'node:test';
import assert from 'node:assert/strict';
import { recordQueryVersion } from '../src/lib/record-query-version.ts';

const data = { day: { studyDate: '2026-10-27', closedSeconds: 60, runningSeconds: 10, goalMinutes: 60, attendance: 'present', isRestDay: false }, activeSession: { id: 'one', startedAt: '2026-10-27T12:00:00Z', endedAt: null } };
const version = value => recordQueryVersion(value, '2026-10-26', '2026-10-27');
test('elapsed snapshot updates do not invalidate history, but mutations do', () => {
  assert.equal(version(data), version({ ...data, day: { ...data.day, runningSeconds: 70 } }));
  assert.notEqual(version(data), version({ ...data, activeSession: null, day: { ...data.day, closedSeconds: 80 } }));
  assert.notEqual(version(data), version({ ...data, day: { ...data.day, goalMinutes: 90 } }));
  assert.notEqual(version(data), version({ ...data, day: { ...data.day, attendance: 'leave' } }));
  assert.equal(recordQueryVersion(data, '2026-10-01', '2026-10-20'), '');
});
