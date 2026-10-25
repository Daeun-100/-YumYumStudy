import { StudyError } from './contracts.ts';
import type { StudyDate } from './contracts.ts';

const DAY = 24 * 60 * 60 * 1000;
const KST = 9 * 60 * 60 * 1000;
const DAY_START = 6 * 60 * 60 * 1000;

function timestamp(value: string | number): number {
  const ms = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) throw new StudyError('VALIDATION', '올바른 시각이 필요합니다.');
  return ms;
}

export function getStudyDate(value: string | number): StudyDate {
  return new Date(timestamp(value) + KST - DAY_START).toISOString().slice(0, 10);
}

export function getStudyDayBounds(date: StudyDate): { startMs: number; endMs: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new StudyError('VALIDATION', '공부 날짜 형식이 올바르지 않습니다.');
  const midnight = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== date) {
    throw new StudyError('VALIDATION', '존재하지 않는 공부 날짜입니다.');
  }
  const startMs = midnight - KST + DAY_START;
  return { startMs, endMs: startMs + DAY };
}

export function secondsInStudyDay(startedAt: string, endedAt: string | number, date: StudyDate): number {
  const { startMs, endMs } = getStudyDayBounds(date);
  const overlap = Math.min(timestamp(endedAt), endMs) - Math.max(timestamp(startedAt), startMs);
  return Math.max(0, Math.floor(overlap / 1000));
}
