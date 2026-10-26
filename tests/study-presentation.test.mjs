import test from 'node:test';
import assert from 'node:assert/strict';
import { displayedSeconds, duration, progress, timer, goalLabel } from '../src/features/study/presentation.ts';
const day = { studyDate: '2026-10-26', closedSeconds: 100, runningSeconds: 30 };
const session = { startedAt: '2026-10-26T10:00:00+09:00' };
test('display adds only time after the server snapshot, never duplicates the running session', () => {
  assert.equal(displayedSeconds(day, session, '2026-10-26T10:00:30+09:00', Date.parse('2026-10-26T10:00:45+09:00')), 145);
  assert.equal(displayedSeconds(day, null, '2026-10-26T10:00:30+09:00', Date.parse('2026-10-26T12:00:00+09:00')), 130);
});
test('old day display stops accumulating at 06:00 while the next snapshot loads', () => {
  assert.equal(displayedSeconds({ ...day, runningSeconds: 10 }, { startedAt: '2026-10-27T05:59:40+09:00' }, '2026-10-27T05:59:50+09:00', Date.parse('2026-10-27T06:00:20+09:00')), 120);
});
test('goals distinguish unset and rest days, preserve overachievement and format long timers', () => {
  assert.equal(progress(60, null), null); assert.equal(progress(60, 0), null);
  assert.equal(progress(7200, 60), 200); assert.equal(progress(1800, 60), 50);
  assert.equal(goalLabel(0), '오늘은 휴무'); assert.equal(goalLabel(null), '목표 미설정');
  assert.equal(timer(4815), '01:20:15'); assert.equal(timer(360000), '100:00:00');
});

test('percentage preserves 123 percent while callers cap only the visual bar', () => {
  assert.equal(progress(4428, 60), 123);
});

test('recorded durations show ticking seconds and goal labels stay in minutes', () => {
  assert.equal(duration(0), '00:00:00');
  assert.equal(duration(59), '00:00:59');
  assert.equal(duration(60), '00:01:00');
  assert.equal(duration(4815), '01:20:15');
  assert.equal(duration(360000), '100:00:00');
  assert.equal(goalLabel(180), '오늘 목표 3시간 0분');
  assert.equal(duration(10800, false), '3시간 0분');
});
