import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudyClock } from '../src/lib/study-clock.ts';

test('clock ticks retain server precision and do not leak between providers', () => {
  const first = createStudyClock();
  const second = createStudyClock();
  let notifications = 0;
  first.subscribe(() => notifications++);
  first.set(1234.5);
  first.set(1234.5);
  assert.equal(first.read(), 1234.5);
  assert.equal(second.read(), 0);
  assert.equal(notifications, 1);
});

test('time subscribers can be removed independently during navigation', () => {
  const clock = createStudyClock();
  let first = 0;
  let second = 0;
  const stop = clock.subscribe(() => first++);
  clock.subscribe(() => second++);
  clock.set(1000);
  stop();
  stop();
  clock.set(2000);
  assert.equal(first, 1);
  assert.equal(second, 2);
});
