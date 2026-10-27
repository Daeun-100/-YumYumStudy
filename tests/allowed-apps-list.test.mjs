import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedAppSections, sortAllowedApps } from '../src/features/allowed-apps/app-list.ts';

const apps = [
  { packageName: 'dictionary', label: '영어 사전' },
  { packageName: 'camera', label: '카메라' },
  { packageName: 'calculator', label: '계산기' },
  { packageName: 'notes', label: '노트' },
];
test('allowed apps appear first, and both groups sort by Korean name without mutating the source', () => {
  const snapshot = structuredClone(apps);
  const sections = allowedAppSections(apps, ['dictionary', 'calculator', 'uninstalled'], '');
  assert.deepEqual(sections.map(section => section.data.map(app => app.label)), [['계산기', '영어 사전'], ['노트', '카메라']]);
  assert.deepEqual(apps, snapshot);
  assert.deepEqual(sortAllowedApps(apps).map(app => app.label), ['계산기', '노트', '영어 사전', '카메라']);
});
test('toggling moves an app between groups; search still matches names and package names', () => {
  assert.deepEqual(allowedAppSections(apps, ['notes'], '')[0].data.map(app => app.packageName), ['notes']);
  assert.deepEqual(allowedAppSections(apps, [], '')[0].data, []);
  assert.deepEqual(allowedAppSections(apps, ['notes'], '  NOTES  ')[0].data.map(app => app.label), ['노트']);
  assert.deepEqual(allowedAppSections(apps, [], '사전')[1].data.map(app => app.packageName), ['dictionary']);
  assert.ok(allowedAppSections(apps, [], '없는 앱').every(section => section.data.length === 0));
});
test('duplicate app names use the package as a stable tie breaker', () => {
  assert.deepEqual(sortAllowedApps([{ packageName: 'b', label: '사전' }, { packageName: 'a', label: '사전' }]).map(app => app.packageName), ['a', 'b']);
});
