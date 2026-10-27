import test from 'node:test';
import assert from 'node:assert/strict';
import { actionConfirmed } from '../src/features/study/pending-action.ts';

test('lost start response followed by an active session allows the next press to stop', () => {
  assert.equal(actionConfirmed({ type: 'start' }, 'session'), true);
  assert.equal(actionConfirmed({ type: 'start' }, null), false);
});
test('lost stop response followed by no active session allows the next press to start', () => {
  const pending = { type: 'stop', id: 'old' };
  assert.equal(actionConfirmed(pending, 'old'), false);
  assert.equal(actionConfirmed(pending, null), true);
  assert.equal(actionConfirmed(pending, 'new'), true);
  assert.equal(actionConfirmed(null, 'new'), false);
});
