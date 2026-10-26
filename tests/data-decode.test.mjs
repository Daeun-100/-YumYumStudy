import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeDay, decodeGoals, decodeHistory, decodeRoom, decodeSession, decodeSnapshot, decodeToday } from '../src/data/decode.ts';

const profile = { id: 'user-a', displayName: '같은이름' };
const day = { studyDate: '2026-10-26', closedSeconds: 1800, runningSeconds: 900, goalMinutes: null, attendance: 'present', isRestDay: false, goalAchieved: null };
const session = { id: 'session-a', userId: profile.id, startedAt: '2026-10-26T00:00:00Z', endedAt: null };

test('decode snapshot keeps provisional and closed times separate', () => {
  const decoded = decodeSnapshot({ serverNow: '2026-10-26T00:15:00Z', data: { profile, day, activeSession: session } }, decodeToday);
  assert.equal(decoded.data.day.closedSeconds, 1800);
  assert.equal(decoded.data.day.runningSeconds, 900);
  assert.equal(decoded.data.day.goalMinutes, null);
  assert.equal(decoded.data.day.attendance, 'present');
  assert.deepEqual(decodeHistory([day]), [day]);
});

test('malformed data and other users active sessions are rejected rather than replaced with zero', () => {
  for (const value of [null, { ...day, runningSeconds: -1 }, { ...day, closedSeconds: '30' }, { ...day, studyDate: '2026-02-30' }, { ...day, attendance: 'unknown' }, { ...day, goalMinutes: 1441 }]) {
    assert.throws(() => decodeDay(value));
  }
  assert.throws(() => decodeToday({ profile, day, activeSession: { ...session, userId: 'user-b' } }));
  assert.throws(() => decodeSession({ ...session, endedAt: '2020-01-01T00:00:00Z' }));
  assert.throws(() => decodeRoom({}));
  assert.throws(() => decodeGoals([]));
  assert.throws(() => decodeSnapshot({ serverNow: 'invalid', data: day }, decodeDay));
});

test('duplicate display names stay separate by UID in room data', () => {
  const room = decodeRoom([
    { profile, today: day, activeSession: session },
    { profile: { ...profile, id: 'user-b' }, today: day, activeSession: null },
  ]);
  assert.equal(room.length, 2);
  assert.notEqual(room[0].profile.id, room[1].profile.id);
});

test('leave attendance is accepted without inventing study time', () => {
  const value = { ...day, attendance: 'leave', closedSeconds: 0, runningSeconds: 0 };
  assert.deepEqual(decodeDay(value), value);
});
