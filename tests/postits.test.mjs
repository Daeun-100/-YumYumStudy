import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePostit, mergePostit } from '../src/features/postits/model.ts';
const note = { id: 'a', room_id: 0, author: '친구', text: '같이 힘내자', color: '#F9E8A0', x: .3, y: .7, study_date: '2026-10-27', deleted_at: null };
test('rejects malformed broadcast payload and positions outside the room', () => {
  assert.deepEqual(decodePostit(note), note);
  for (const invalid of [null, {}, { ...note, x: NaN }, { ...note, y: 2 }, { ...note, color: 'red' }]) assert.throws(() => decodePostit(invalid));
});
test('duplicate delivery and late create events never resurrect a deleted note', () => {
  const created = mergePostit(mergePostit([], note), note);
  assert.equal(created.length, 1);
  const deleted = { ...note, deleted_at: '2026-10-27T01:00:00Z' };
  const result = mergePostit(mergePostit(created, deleted), note);
  assert.equal(result[0].deleted_at, deleted.deleted_at);
});
