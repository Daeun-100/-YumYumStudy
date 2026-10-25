import { StudyError, validateGoalWeek } from '../lib/contracts.ts';
import type { DayRecord, GoalWeek, Profile, RoomMember, Snapshot, StudySession, TodayData } from '../lib/contracts.ts';
import { getStudyDayBounds } from '../lib/study-day.ts';

function invalid(): never { throw new StudyError('UNKNOWN', '서버 기록 형식을 확인하지 못했습니다. 다시 조회해 주세요.'); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown): string { return typeof value === 'string' && value.length > 0 ? value : invalid(); }
function instant(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) return invalid();
  return result;
}
function seconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return invalid();
  return value;
}
export function decodeProfile(value: unknown): Profile {
  const row = record(value);
  return { id: text(row.id), displayName: text(row.displayName) };
}
export function decodeSession(value: unknown): StudySession {
  const row = record(value);
  const startedAt = instant(row.startedAt);
  const endedAt = row.endedAt === null ? null : instant(row.endedAt);
  if (endedAt && Date.parse(endedAt) < Date.parse(startedAt)) return invalid();
  return { id: text(row.id), userId: text(row.userId), startedAt, endedAt };
}
export function decodeDay(value: unknown): DayRecord {
  const row = record(value);
  const studyDate = text(row.studyDate);
  getStudyDayBounds(studyDate);
  if (row.attendance !== 'pending') return invalid();
  return {
    studyDate, closedSeconds: seconds(row.closedSeconds), runningSeconds: seconds(row.runningSeconds),
    goalMinutes: row.goalMinutes === null ? null : seconds(row.goalMinutes), attendance: 'pending',
  };
}
export function decodeGoals(value: unknown): GoalWeek {
  validateGoalWeek(value);
  return value;
}
export function decodeSnapshot<T>(value: unknown, decode: (value: unknown) => T): Snapshot<T> {
  const row = record(value);
  return { serverNow: instant(row.serverNow), data: decode(row.data) };
}
export function decodeToday(value: unknown): TodayData {
  const row = record(value);
  const profile = decodeProfile(row.profile);
  const activeSession = row.activeSession === null ? null : decodeSession(row.activeSession);
  if (activeSession && (activeSession.userId !== profile.id || activeSession.endedAt !== null)) return invalid();
  return { profile, day: decodeDay(row.day), activeSession };
}
export function decodeRoom(value: unknown): RoomMember[] {
  if (!Array.isArray(value)) return invalid();
  return value.map((item) => {
    const row = record(item);
    const today = decodeToday({ profile: row.profile, day: row.today, activeSession: row.activeSession });
    return { profile: today.profile, today: today.day, activeSession: today.activeSession };
  });
}
export function decodeHistory(value: unknown): DayRecord[] {
  if (!Array.isArray(value)) return invalid();
  return value.map(decodeDay);
}
