import test from 'node:test';
import assert from 'node:assert/strict';
import { reservationReason, weeklyAchievement, koreanDate } from '../src/features/leave/model.ts';
const now = Date.parse('2026-10-27T01:00:00+09:00');
const grant = { id: 'a', status: 'AVAILABLE', scheduledDate: null, expiresAt: '2026-11-02T06:00:00+09:00' };
test('calendar uses the study date and excludes the expiry boundary', () => {
  assert.equal(reservationReason('2026-10-26', '2026-10-26', [grant], now), null);
  assert.match(reservationReason('2026-10-25', '2026-10-26', [grant], now), /지난/);
  assert.equal(reservationReason('2026-10-27', '2026-10-26', [grant], now), null);
  assert.equal(reservationReason('2026-11-01', '2026-10-26', [grant], now), null);
  assert.match(reservationReason('2026-11-02', '2026-10-26', [grant], now), /없어요/);
  assert.match(reservationReason('2026-10-27', '2026-10-26', [], now), /없어요/);
});
test('date changes reuse only the original unstarted grant and reject occupied dates', () => {
  const scheduled = { ...grant, status: 'SCHEDULED', scheduledDate: '2026-10-28' };
  assert.equal(reservationReason('2026-10-29', '2026-10-26', [scheduled], now, 'a'), null);
  assert.match(reservationReason('2026-10-29', '2026-10-26', [scheduled], now), /없어요/);
  const other = { ...scheduled, id: 'b', scheduledDate: '2026-10-29' };
  assert.match(reservationReason('2026-10-29', '2026-10-26', [scheduled, other], now, 'a'), /이미/);
  assert.match(reservationReason('2026-10-29', '2026-10-28', [scheduled], Date.parse('2026-10-28T06:00:00+09:00'), 'a'), /없어요/);
});
test('weekly leave progress excludes rest, unset goals and leave days while including running study', () => {
  const day = { goalMinutes: 1, closedSeconds: 30, runningSeconds: 30, attendance: 'present', isRestDay: false };
  assert.equal(weeklyAchievement([day, { ...day, attendance: 'leave' }, { ...day, goalMinutes: 0, isRestDay: true }, { ...day, goalMinutes: null }, { ...day, runningSeconds: 29 }]), 1);
  assert.equal(weeklyAchievement(Array(7).fill(day)), 6);
  assert.equal(koreanDate('2026-11-01T21:00:00Z'), '2026-11-02');
});

test('same-day use protects reward eligibility before and after reconciliation', () => {
  const today = '2026-11-01';
  const n = Date.parse(today + 'T12:00:00+09:00');
  const days = Array.from({length:7}, (_,i) => ({studyDate: '2026-' + (i < 6 ? '10-' + (26+i) : '11-01'), goalMinutes:1, closedSeconds:60, runningSeconds:0, attendance:'present', isRestDay:false}));
  const g = {...grant, earnedAt:'2026-10-26T06:00:00+09:00', earningWeek:'2026-10-19'};
  assert.equal(reservationReason(today,today,[g],n,null,days),null);
  const six = days.filter(d=>d.studyDate!=='2026-10-26');
  assert.match(reservationReason(today,today,[g],n,null,six),/보상/);
  assert.equal(reservationReason(today,today,[g],n,null,six.slice(1)),null);
  const reward = {...g,id:'r',earningWeek:'2026-10-26',status:'USED',scheduledDate:'2026-11-03'};
  assert.match(reservationReason(today,today,[g,reward],n,null,six),/보상/);
  assert.match(reservationReason(today,today,[g],Date.parse('2026-11-02T06:00:00+09:00'),null,days),/지난/);
});
