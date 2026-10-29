import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createMemoryCache } from '../src/lib/memory-cache.ts';
import * as presentation from '../src/features/study/presentation.ts';
import * as sessionModel from '../src/features/records/session-model.ts';
import { recordQueryVersion } from '../src/lib/record-query-version.ts';

const modelContext = { exports: {}, require: () => presentation };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/features/records/model.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, modelContext);
const model = modelContext.exports;

const date = '2026-10-27';
const serverNow = '2026-10-27T12:00:00Z';
const day = { studyDate: date, closedSeconds: 60, runningSeconds: 0, goalMinutes: 60, attendance: 'present', isRestDay: false };
const member = { profile: { id: 'friend' }, today: day, activeSession: null };
const study = { today: { serverNow, data: { day, activeSession: null } }, room: { serverNow, data: [member] }, error: null, roomError: null };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function harness(friend = false) {
  const cache = createMemoryCache();
  const summary = deferred();
  const sessions = new Map();
  const calls = [];
  const failures = new Map();
  const states = new Map();
  let current, cursor;
  const jsx = (type, props, key) => {
    if (typeof type !== 'function') return { type, props };
    const previous = [current, cursor];
    current = `${type.name}:${key ?? ''}`; cursor = 0;
    if (!states.has(current)) states.set(current, []);
    const result = type(props);
    [current, cursor] = previous;
    return result;
  };
  const modules = {
    react: {
      useState(initial) { const slots = states.get(current); const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
      useCallback: callback => callback, useMemo: factory => factory(), useEffect: effect => { effect(); },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Text: 'Text', ScrollView: 'ScrollView', Modal: 'Modal', Pressable: 'Pressable', StyleSheet: { create: value => value } },
    '../../design/theme': { colors: {}, spacing: {}, typography: {} },
    '../../design/components': { Button: 'Button', InfoButton: 'InfoButton', SegmentedControl: 'SegmentedControl' },
    '../../design/Skeleton': { SkeletonRegion: 'SkeletonRegion', DetailSkeleton: 'DetailSkeleton' },
    './RecordComponents': { DayDetail: 'DayDetail', MonthlyCalendar: 'MonthlyCalendar', PeriodHeader: 'PeriodHeader', RecordLegend: 'RecordLegend', WeeklyChart: 'WeeklyChart' },
    './model': model, '../records/model': model,
    './session-model': sessionModel,
    '../study/study-resources': { useStudyResources: () => {} },
    '../study/StudyProvider': { useStudy: () => study },
    '../study/useScreenNow': { useScreenNow: () => Date.parse(serverNow) },
    '../study/StudyUI': { Nav: 'Nav', ui: {} },
    '../study/presentation': presentation,
    '../../lib/record-query-version': { recordQueryVersion },
    '../../lib/study-day': { getStudyDate: () => date },
    '../../data/study': { getHistory: () => { calls.push('summary'); return summary.promise; }, getMemberHistory: () => { calls.push('summary'); return summary.promise; } },
    '../../data/record-sessions': { getDaySessions: (selected, id) => { calls.push(`detail:${id ?? 'self'}:${selected}`); const result = deferred(); sessions.set(selected, result); return result.promise; } },
    '../../data/useMemoryQuery': { useMemoryQuery(parts, loader, options) {
      const key = JSON.stringify(parts);
      if (!failures.has(key)) void cache.load(key, loader, options.staleTime, options.version).catch(error => failures.set(key, error.message));
      const data = cache.read(key);
      const error = failures.get(key) ?? '';
      return { data, error, loading: data === undefined && !error, cached: false, retry() {} };
    } },
  };
  function load(path, exportsName) {
    const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const context = { exports: {}, require(name) { assert.ok(name in modules, `unexpected import ${name}`); return modules[name]; } };
    vm.runInNewContext(source, context);
    return context.exports[exportsName];
  }
  const detail = load('../src/features/records/OwnDayDetail.tsx', 'OwnDayDetail');
  const preview = load('../src/features/records/RecordsPreview.tsx', 'RecordsPreview');
  modules['./OwnDayDetail'] = modules['../records/OwnDayDetail'] = { OwnDayDetail: detail };
  modules['./RecordsPreview'] = modules['../records/RecordsPreview'] = { RecordsPreview: preview };
  const screen = friend ? load('../src/features/friends/FriendRecords.tsx', 'FriendRecords') : load('../src/features/records/RecordsScreen.tsx', 'RecordsScreen');
  return { render: () => jsx(screen, friend ? { member, onBack() {} } : {}), calls, summary, sessions, cache };
}
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(item => nodes(item, type));
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
}
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
for (const friend of [false, true]) test(`${friend ? 'friend' : 'own'} summary and detail start together before summary resolves`, async () => {
  const app = harness(friend);
  const tree = app.render();
  await settle();
  assert.deepEqual(app.calls, ['summary', `detail:${friend ? 'friend' : 'self'}:${date}`]);
  assert.equal(nodes(tree, 'DetailSkeleton').length, 0);
  assert.equal(nodes(tree, 'SkeletonRegion').find(node => node.props.label === '상세 공부 기록 불러오는 중').props.loading, true);
  app.sessions.get(date).resolve([]);
  await settle();
  assert.equal(nodes(app.render(), 'SkeletonRegion').find(node => node.props.label === '상세 공부 기록 불러오는 중').props.loading, true);
  app.summary.resolve({ serverNow, data: [day] });
  await settle();
  assert.equal(nodes(app.render(), 'SkeletonRegion').find(node => node.props.label === '상세 공부 기록 불러오는 중').props.loading, false);
  assert.equal(app.calls.length, 2);
});

test('changing selection while summary is pending starts new detail and isolates a late old response', async () => {
  const app = harness();
  const tree = app.render();
  await settle();
  nodes(tree, 'WeeklyChart')[0].props.onSelect('2026-10-26');
  app.render();
  await settle();
  assert.ok(app.sessions.has('2026-10-26'));
  app.sessions.get('2026-10-26').resolve([]);
  app.sessions.get(date).resolve([{ id: 'old-date' }]);
  app.summary.resolve({ serverNow, data: [day] });
  await settle();
  const current = app.render();
  assert.equal(nodes(current, 'DayDetail')[0].props.day.date, '2026-10-26');
  assert.deepEqual(nodes(current, 'DayDetail')[0].props.day.sessions, []);
});

test('a failed summary does not prevent the independent session request from completing', async () => {
  const app = harness();
  app.render();
  await settle();
  app.summary.reject(Error('summary unavailable'));
  app.sessions.get(date).resolve([]);
  await settle();
  const tree = app.render();
  assert.ok(nodes(tree, 'Text').some(node => node.props.children === 'summary unavailable'));
  assert.equal(nodes(tree, 'DayDetail')[0].props.aggregateOnly, false);
});

test('a failed session request leaves the loaded summary visible and offers a detail retry', async () => {
  const app = harness();
  app.render();
  await settle();
  app.summary.resolve({ serverNow, data: [day] });
  app.sessions.get(date).reject(Error('detail unavailable'));
  await settle();
  const tree = app.render();
  assert.equal(nodes(tree, 'SkeletonRegion').find(node => node.props.label === '기록 요약 불러오는 중').props.loading, false);
  assert.ok(nodes(tree, 'Button').some(node => node.props.label === '상세 기록 다시 불러오기'));
});
