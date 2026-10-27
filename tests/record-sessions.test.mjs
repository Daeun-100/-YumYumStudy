import test from 'node:test';
import assert from 'node:assert/strict';
import { liveRecordMinutes, recordSessions } from '../src/features/records/session-model.ts';
const session = (startedAt, endedAt) => ({ id: 'one', userId: 'self', startedAt, endedAt });

test('session detail splits overnight study at 06:00 KST', () => {
  const sessions = [session('2026-10-26T05:30:00+09:00', '2026-10-26T06:30:00+09:00')];
  const now = Date.parse('2026-10-26T07:00:00+09:00');
  assert.deepEqual(recordSessions(sessions, '2026-10-25', now), [{ start: '05:30:00', end: '06:00:00', minutes: 30 }]);
  assert.deepEqual(recordSessions(sessions, '2026-10-26', now), [{ start: '06:00:00', end: '06:30:00', minutes: 30 }]);
});
test('running study ticks in seconds and closes display at the study day boundary', () => {
  const sessions = [session('2026-10-26T05:59:30+09:00', null)];
  const now = Date.parse('2026-10-26T06:00:15+09:00');
  assert.deepEqual(recordSessions(sessions, '2026-10-25', now), [{ start: '05:59:30', end: '06:00:00', minutes: 0.5 }]);
  assert.deepEqual(recordSessions(sessions, '2026-10-26', now), [{ start: '06:00:00', end: '공부 중', minutes: 0.25 }]);
});
test('sessions outside the selected study day are excluded', () => {
  const sessions = [session('2026-10-25T10:00:00+09:00', '2026-10-25T11:00:00+09:00'), session('2026-10-26T06:00:00+09:00', '2026-10-26T06:01:00+09:00')];
  assert.deepEqual(recordSessions(sessions, '2026-10-25', Date.parse('2026-10-27T10:00:00+09:00')), [{ start: '10:00:00', end: '11:00:00', minutes: 60 }]);
  assert.deepEqual(recordSessions([], '2026-10-26', Date.now()), []);
});

test('live detail advances summary seconds without double counting or crossing 06:00', () => {
  const asOf = Date.parse('2026-10-27T05:59:30+09:00');
  const day = { date: '2026-10-26', minutes: 10, asOf };
  assert.equal(liveRecordMinutes(day, asOf + 15000, true), 10.25);
  assert.equal(liveRecordMinutes(day, asOf + 90000, true), 10.5);
  assert.equal(liveRecordMinutes(day, asOf - 1000, true), 10);
  assert.equal(liveRecordMinutes(day, asOf + 15000, false), 10);
  assert.equal(liveRecordMinutes({ ...day, minutes: 10.25, asOf: asOf + 15000 }, asOf + 15000, true), 10.25);
});
