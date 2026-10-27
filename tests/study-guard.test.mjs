import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDeparture } from '../src/features/study/guard-core.ts';
import { needsStudyGuard } from '../src/features/study/timer-mode-core.ts';
const canMonitorStudy = status => needsStudyGuard(status, null);
const make = () => ({ serverNow: '2026-10-27T03:02:00.000Z', data: {
  profile: { id: 'owner' }, day: { studyDate: '2026-10-27', closedSeconds: 100, runningSeconds: 120 },
  activeSession: { id: 'session', startedAt: '2026-10-27T03:00:00.000Z' },
} });
test('late server snapshot is shortened to native departure, not RPC arrival', () => {
  const original = make();
  const stopped = applyDeparture(original, 'session', '2026-10-27T03:00:30.000Z');
  assert.equal(stopped.data.day.closedSeconds, 130);
  assert.equal(stopped.data.day.runningSeconds, 0);
  assert.equal(stopped.data.activeSession, null);
  assert.equal(original.data.day.runningSeconds, 120);
  assert.equal(applyDeparture(stopped, 'session', '2026-10-27T03:00:30.000Z'), stopped);
});
test('stop acknowledgement from a previous session cannot stop a new session', () => {
  const snapshot = make();
  assert.equal(applyDeparture(snapshot, 'previous-session', '2026-10-27T03:00:30Z'), snapshot);
});
test('offline departure across the 06:00 boundary only retains time within the displayed study day', () => {
  const snapshot = make();
  snapshot.serverNow = '2026-10-27T21:10:00Z';
  snapshot.data.day.studyDate = '2026-10-28';
  snapshot.data.day.runningSeconds = 600;
  snapshot.data.activeSession.startedAt = '2026-10-27T20:50:00Z';
  const stopped = applyDeparture(snapshot, 'session', '2026-10-27T20:59:00Z');
  assert.equal(stopped.data.day.closedSeconds, 100);
  assert.equal(stopped.data.activeSession, null);
});

test('basic timer needs no native permissions or selected allowed apps', () => {
  assert.equal(canMonitorStudy(null), false);
  assert.equal(canMonitorStudy({ usageAccess: false, notificationAccess: false, allowed: ['app'] }), false);
  assert.equal(canMonitorStudy({ usageAccess: true, notificationAccess: false, allowed: ['app'] }), false);
  assert.equal(canMonitorStudy({ usageAccess: false, notificationAccess: true, allowed: ['app'] }), false);
  assert.equal(canMonitorStudy({ usageAccess: true, notificationAccess: true, allowed: [] }), false);
  assert.equal(canMonitorStudy({ usageAccess: true, notificationAccess: true, allowed: ['app'] }), true);
});
