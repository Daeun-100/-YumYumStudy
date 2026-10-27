import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveDayStatus } from '../src/lib/day-status.ts';
import { validateGoalWeek } from '../src/lib/contracts.ts';
import { decodeGoalSettings } from '../src/data/decode.ts';

const now = Date.parse('2026-10-26T12:00:00+09:00');

test('one recorded second is attendance regardless of a larger study goal', () => {
  assert.deepEqual(deriveDayStatus('2026-10-26', 120, 1, 0, now), { attendance: 'present', isRestDay: false, goalAchieved: false });
  assert.equal(deriveDayStatus('2026-10-26', 120, 0, 1, now).attendance, 'present');
  assert.equal(deriveDayStatus('2026-10-26', 120, 0, 0, now).attendance, 'pending');
});

test('rest days and unset goals are distinct and have no goal completion ratio', () => {
  assert.deepEqual(deriveDayStatus('2026-10-26', 0, 0, 1, now), { attendance: 'present', isRestDay: true, goalAchieved: null });
  assert.deepEqual(deriveDayStatus('2026-10-26', null, 0, 1, now), { attendance: 'present', isRestDay: false, goalAchieved: null });
  assert.equal(deriveDayStatus('2026-10-26', 1, 59, 0, now).goalAchieved, false);
  assert.equal(deriveDayStatus('2026-10-26', 1, 59, 1, now).goalAchieved, true);
});

test('no-study attendance stays pending until exactly the next 06:00', () => {
  assert.equal(deriveDayStatus('2026-10-25', 60, 0, 0, Date.parse('2026-10-26T05:59:59+09:00')).attendance, 'pending');
  assert.equal(deriveDayStatus('2026-10-25', 60, 0, 0, Date.parse('2026-10-26T06:00:00+09:00')).attendance, 'absent');
  assert.equal(deriveDayStatus('2026-10-27', 0, 0, 0, now).attendance, 'pending');
  assert.equal(deriveDayStatus('2026-10-25', 0, 0, 0, now).isRestDay, true);
});

test('goals allow null, zero and 1440 but reject negative, fractional and larger inputs', () => {
  validateGoalWeek([0, 1440, null, 60, 1, 30, null]);
  for (const value of [-1, 1441, 1.5]) {
    assert.throws(() => validateGoalWeek([value, null, null, null, null, null, null]));
    assert.throws(() => deriveDayStatus('2026-10-26', value, 0, 0, now));
  }
});

test('goal settings preserve current versus scheduled and require a matching effective date', () => {
  const current = [null, null, null, null, null, null, null];
  const scheduled = [0, 1440, 60, 60, 60, null, null];
  assert.deepEqual(decodeGoalSettings({ current, scheduled, effectiveDate: '2026-10-27' }), { current, scheduled, effectiveDate: '2026-10-27' });
  assert.throws(() => decodeGoalSettings({ current, scheduled, effectiveDate: null }));
  assert.throws(() => decodeGoalSettings({ current, scheduled: null, effectiveDate: '2026-10-27' }));
});

test('leave replaces attendance at 06:00 but retains actual study goal completion', () => {
  assert.equal(deriveDayStatus('2026-10-26', 60, 0, 0, Date.parse('2026-10-26T05:59:59+09:00'), true).attendance, 'pending');
  assert.equal(deriveDayStatus('2026-10-26', 60, 0, 0, Date.parse('2026-10-26T06:00:00+09:00'), true).attendance, 'leave');
  assert.deepEqual(deriveDayStatus('2026-10-26', 60, 3600, 0, now, true), { attendance: 'leave', isRestDay: false, goalAchieved: true });
  assert.equal(deriveDayStatus('2026-10-25', 60, 0, 0, now, true).attendance, 'leave');
});
