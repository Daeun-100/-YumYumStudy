import test from 'node:test';
import assert from 'node:assert/strict';
import { changeWeekday, goalText, parseGoal } from '../src/features/goals/model.ts';

test('editing a weekday preserves the latest scheduled days and current history', () => {
  const current = [60, 120, null, 0, 180, 240, 0];
  const scheduled = [90, 150, 45, 0, 180, 240, 0];
  const settings = { current, scheduled, effectiveDate: '2026-10-27' };
  const result = changeWeekday(settings, 0, 120);
  assert.deepEqual(result, [120, 150, 45, 0, 180, 240, 0]);
  assert.equal(settings.current[0], 60);
  assert.equal(settings.scheduled[0], 90);
  assert.equal(changeWeekday({ ...settings, scheduled: null }, 2, 0)[2], 0);
  assert.equal(changeWeekday(settings, 2, null)[2], null);
});
test('existing minute precision, rest and unset remain distinct', () => {
  assert.equal(parseGoal('3', '45'), 225);
  assert.equal(parseGoal('24', '00'), 1440);
  assert.equal(goalText(null), '미설정');
  assert.equal(goalText(0), '쉬는 날');
  assert.equal(goalText(225), '3시간 45분');
  for (const [h, m] of [['24','01'], ['0','00'], ['2','60'], ['', '30'], ['-1','30'], ['1.5','0']]) assert.throws(() => parseGoal(h,m));
});

test('weekly save merges all locally edited days while preserving concurrent remote changes', async () => {
  const { mergeGoalDraft, sameGoals } = await import('../src/features/goals/model.ts');
  const base = [60, 120, 45, 0, null, 240, 0];
  const draft = [180, 120, 45, null, 30, 240, 0];
  const settings = { current: base, scheduled: [60, 90, 45, 0, null, 300, 0], effectiveDate: '2026-10-28' };
  assert.deepEqual(mergeGoalDraft(settings, base, draft), [180, 90, 45, null, 30, 300, 0]);
  assert.deepEqual(base, [60, 120, 45, 0, null, 240, 0]);
  assert.equal(sameGoals(base, [...base]), true);
  assert.equal(sameGoals(base, draft), false);
});
test('refresh and response-loss retry preserve rest, unset and legacy minute goals', async () => {
  const { mergeGoalDraft } = await import('../src/features/goals/model.ts');
  const base = [45, 0, null, 60, 60, 60, 0];
  const draft = [45, null, 0, 120, 60, 60, 0];
  const accepted = { current: base, scheduled: draft, effectiveDate: '2026-10-28' };
  assert.deepEqual(mergeGoalDraft(accepted, base, draft), draft);
  const afterBoundary = { current: draft, scheduled: null, effectiveDate: null };
  assert.deepEqual(mergeGoalDraft(afterBoundary, base, draft), draft);
});
