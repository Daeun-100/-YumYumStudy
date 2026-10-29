import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as presentation from '../src/features/study/presentation.ts';

const source = ts.transpileModule(readFileSync(new URL('../src/features/study/FocusScreen.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const serverNow = '2026-10-27T01:00:00Z';
function member(id, seconds, goalMinutes, active = false) {
  return {
    profile: { id, displayName: id, character: 'bear' },
    today: { studyDate: '2026-10-27', closedSeconds: active ? 0 : seconds, runningSeconds: active ? seconds : 0, goalMinutes, goalAchieved: false },
    activeSession: active ? { id: `session-${id}`, userId: id, startedAt: new Date(Date.parse(serverNow) - seconds * 1000).toISOString(), endedAt: null } : null,
  };
}
function focusProps(study, ownerId, focused = true) {
  const element = (type, props) => ({ type, props });
  const modules = {
    react: { useState: initial => [initial, () => {}] },
    'react/jsx-runtime': { jsx: element, jsxs: element },
    'react-native': { View: 'View' },
    'expo-router': { router: {}, useIsFocused: () => focused },
    '../../components/IdentityProvider': { useIdentity: () => ({ profile: { id: ownerId, displayName: ownerId } }) },
    '../events/useEventBackgrounds': { useEventBackgrounds: () => ({}) },
    './StudyProvider': { useStudy: () => study },
    './study-resources': { useStudyResources: () => {} },
    './useScreenNow': { useScreenNow: () => study.now },
    './FocusScreenView': { FocusScreenView: 'FocusScreenView' },
    './presentation': presentation,
    '../navigation/useAndroidBack': { useAndroidBack: () => {} },
    './StudyControl': {}, '../call-friend/CallFriendDialog': {}, '../postits/PostitOverlay': {}, '../allowed-apps/AllowedAppsLauncher': {},
  };
  const context = { exports: {}, require: name => {
    assert.ok(name in modules, `unexpected import ${name}`);
    return modules[name];
  } };
  vm.runInNewContext(source, context);
  return context.exports.FocusScreen().props;
}

test('every viewer receives achievement flags for all friends using each friend’s own goal', () => {
  const room = { serverNow, data: [member('a', 3600, 60, true), member('b', 7200, 120), member('c', 3599, 60, true), member('d', 9000, null), member('e', 9000, 0)] };
  for (const owner of room.data) {
    const props = focusProps({ room, now: Date.parse(serverNow), today: null }, owner.profile.id);
    for (const friend of props.members.filter(value => !value.self)) {
      assert.equal(friend.achieved, ['a', 'b'].includes(friend.id), `${owner.profile.id} viewing ${friend.id}`);
    }
  }
});

test('friend aura activates at the goal boundary between room snapshots and survives pause', () => {
  const friend = member('friend', 3599, 60, true);
  const study = { room: { serverNow, data: [friend] }, now: Date.parse(serverNow), today: null };
  const achieved = () => focusProps(study, 'owner').members.find(value => value.id === 'friend').achieved;
  assert.equal(achieved(), false);
  study.now += 1000;
  assert.equal(achieved(), true);
  study.room.data = [member('friend', 3600, 60)];
  assert.equal(achieved(), true);
});

test('focus screen stops skin effects when navigation leaves the screen', () => {
  const study = { room: { serverNow, data: [] }, now: Date.parse(serverNow), today: null };
  assert.equal(focusProps(study, 'owner', true).effectsEnabled, true);
  assert.equal(focusProps(study, 'owner', false).effectsEnabled, false);
});
