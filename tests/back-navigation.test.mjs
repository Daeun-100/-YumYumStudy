import test from 'node:test';
import assert from 'node:assert/strict';
import { leaveBackTarget } from '../src/features/navigation/back-policy.ts';

test('back closes confirmation, returns from calendar to leave home, then leaves the screen', () => {
  const state = { confirmation: true, details: false, calendar: true, busy: false };
  assert.equal(leaveBackTarget(state), 'confirmation');
  state.confirmation = false;
  assert.equal(leaveBackTarget(state), 'home');
  state.calendar = false;
  assert.equal(leaveBackTarget(state), 'parent');
});

test('leave information closes before leaving its underlying screen', () => {
  for (const calendar of [true, false]) {
    assert.equal(leaveBackTarget({ confirmation: false, details: true, calendar, busy: false }), 'details');
  }
});

test('an in-flight reservation cannot be dismissed, but back works again once it settles', () => {
  const state = { confirmation: true, details: false, calendar: true, busy: true };
  assert.equal(leaveBackTarget(state), 'blocked');
  state.busy = false;
  assert.equal(leaveBackTarget(state), 'confirmation');
  state.confirmation = false;
  assert.equal(leaveBackTarget(state), 'home');
});
