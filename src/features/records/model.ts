import { timer } from '../study/presentation';
export type RecordSession = { start: string; end: string; minutes: number };
export type StudyRecord = { date: string; minutes: number; goal: number | null; status: 'study' | 'empty' | 'rest' | 'leave'; sessions: RecordSession[] };
export const previewToday = '2026-10-26';
export const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export const parseDate = (key: string) => new Date(`${key}T00:00:00Z`);
export function shiftDate(key: string, days: number) { const date = parseDate(key); date.setUTCDate(date.getUTCDate() + days); return dateKey(date); }
export function weekStart(key: string) { const date = parseDate(key); return shiftDate(key, -((date.getUTCDay() + 6) % 7)); }
export function monthStart(key: string) { return `${key.slice(0, 7)}-01`; }
export function shiftMonth(key: string, offset: number) { const date = parseDate(monthStart(key)); date.setUTCMonth(date.getUTCMonth() + offset); return dateKey(date); }
export const duration = (value: number) => { const minutes = Math.floor(value); return minutes >= 60 ? `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ''}` : `${minutes}분`; };
export const recordedDuration = (minutes: number) => timer(Math.round(minutes * 60));
export const achieved = (day: StudyRecord) => day.goal !== null && day.goal > 0 && day.minutes >= day.goal;
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
// Deterministic sample data only. All totals come from the same session list.
export function previewRecord(key: string, profile = { id: '0', goal: 180 as number | null, todayMinutes: 180 }, empty = false): StudyRecord {
  const date = parseDate(key); const n = date.getUTCDate();
  const future = key > previewToday;
  const rest = profile.goal === 0 || date.getUTCDay() === 0;
  const leave = !rest && n === 10;
  const status = rest ? 'rest' : leave ? 'leave' : empty || future || (n % 8 === 0 && n !== 16) ? 'empty' : 'study';
  const goal = rest ? 0 : profile.goal;
  const minutes = status !== 'study' ? 0 : key === previewToday ? profile.todayMinutes : key === '2026-10-16' ? 135 : 40 + (n * 43 + Number(profile.id) * 19) % 240;
  const chunks = minutes > 120 ? [60, 45, minutes - 105] : minutes > 60 ? [45, minutes - 45] : minutes ? [minutes] : [];
  const starts = [540, 810, 1110];
  const sessions = chunks.map((value, i) => ({ start: clock(starts[i]), end: clock(starts[i] + value), minutes: value }));
  return { date: key, goal, status, minutes, sessions };
}
