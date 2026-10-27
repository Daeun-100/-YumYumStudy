import test from 'node:test';
import assert from 'node:assert/strict';
import { recordSessions } from '../src/features/records/session-model.ts';
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
