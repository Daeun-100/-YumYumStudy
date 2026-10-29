import test from 'node:test';
import assert from 'node:assert/strict';
import { watermelonFillPoints, watermelonGoalPercent } from '../src/design/watermelon-fill.ts';

test('progress preserves partial seconds and only completes at the goal', () => {
  assert.equal(watermelonGoalPercent(90 * 60, 180), 50);
  assert.ok(watermelonGoalPercent(60 * 60 - 1, 60) < 100);
  assert.equal(watermelonGoalPercent(60 * 60, 60), 100);
  assert.equal(watermelonGoalPercent(90 * 60, 60), 100);
  assert.equal(watermelonGoalPercent(30, 1), 50);
});

test('rest and unset goals cannot produce a filled watermelon', () => {
  for (const goal of [null, 0, -1, NaN, Infinity]) assert.equal(watermelonGoalPercent(3600, goal), null);
  for (const seconds of [-1, NaN, Infinity]) assert.equal(watermelonGoalPercent(seconds, 60), 0);
});

test('empty, completed and invalid clip inputs are bounded', () => {
  for (const percent of [0, -20, NaN, Infinity]) assert.equal(watermelonFillPoints(percent), '0,100 0,100 0,100');
  for (const percent of [100, 120]) assert.equal(watermelonFillPoints(percent), '0,0 100,0 100,100 0,100');
});

test('half-filled watermelon reveals the bottom-left side at 20 degrees', () => {
  const points = watermelonFillPoints(50).split(' ').map(pair => pair.split(',').map(Number));
  const left = points.find(([x, y]) => x === 0 && y < 100);
  const right = points.find(([x, y]) => x === 100 && y < 100);
  assert.ok(left && right);
  const angle = Math.atan((right[1] - left[1]) / 100) * 180 / Math.PI;
  assert.ok(Math.abs(angle - 20) < .001);
  assert.ok(left[1] < 50 && right[1] > 50);
});

test('visible circle area follows progress rather than transparent image corners', () => {
  const inside = (x, y, points) => points.every((a, i) => {
    const b = points[(i + 1) % points.length];
    return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) >= -.001;
  });
  let previous = 0;
  for (const percent of [1, 10, 25, 50, 75, 90, 99]) {
    const points = watermelonFillPoints(percent).split(' ').map(pair => pair.split(',').map(Number));
    assert.ok(points.flat().every(value => Number.isFinite(value) && value >= 0 && value <= 100));
    let visible = 0;
    let total = 0;
    for (let x = .5; x < 100; x++) for (let y = .5; y < 100; y++) {
      if ((x - 50) ** 2 + (y - 50) ** 2 <= 40 ** 2) {
        total++;
        if (inside(x, y, points)) visible++;
      }
    }
    assert.ok(Math.abs(visible / total * 100 - percent) < 1);
    assert.ok(visible > previous);
    previous = visible;
  }
});
