import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeCharacter, characterIds } from '../src/lib/characters.ts';
import { decodeProfile, decodeRoom } from '../src/data/decode.ts';
import { decodeOnboarding } from '../src/lib/onboarding.ts';

test('legacy profiles default to bunny and all supported characters survive decoding', () => {
  assert.equal(decodeCharacter(undefined), 'bunny');
  for (const character of characterIds) {
    const profile = { id: 'a', displayName: '친구', character };
    assert.deepEqual(decodeProfile(profile), profile);
    assert.equal(decodeOnboarding({ step: 'ready', profile }).profile.character, character);
  }
  for (const character of [null, '', 'unknown', 1, {}]) assert.throws(() => decodeCharacter(character));
});
test('room preserves each member character independently of duplicate nicknames', () => {
  const today = { studyDate: '2026-10-26', closedSeconds: 0, runningSeconds: 0, goalMinutes: null, attendance: 'pending', isRestDay: false, goalAchieved: null };
  const room = decodeRoom(['bear', 'cat'].map((character, i) => ({ profile: { id: String(i), displayName: '친구', character }, today, activeSession: null })));
  assert.deepEqual(room.map(m => m.profile.character), ['bear', 'cat']);
});
