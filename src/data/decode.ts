import { decodeCharacter } from '../lib/characters.ts';
import { StudyError, validateGoalWeek } from '../lib/contracts.ts';
import type { DayRecord, GoalSettings, GoalWeek, LeaveGrant, LeaveState, LeaveStatus, Profile, RoomMember, Snapshot, StudySession, TodayData } from '../lib/contracts.ts';
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
  return { id: text(row.id), displayName: text(row.displayName), character: decodeCharacter(row.character) };
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
  if (!['pending', 'present', 'absent', 'leave'].includes(String(row.attendance))
    || typeof row.isRestDay !== 'boolean'
    || (row.goalAchieved !== null && typeof row.goalAchieved !== 'boolean')) return invalid();
  const goalMinutes = row.goalMinutes === null ? null : seconds(row.goalMinutes);
  if (goalMinutes !== null && goalMinutes > 1440) return invalid();
  return {
    studyDate, closedSeconds: seconds(row.closedSeconds), runningSeconds: seconds(row.runningSeconds),
    goalMinutes, attendance: row.attendance as DayRecord['attendance'],
    isRestDay: row.isRestDay, goalAchieved: row.goalAchieved,
  };
}
export function decodeGoals(value: unknown): GoalWeek {
  validateGoalWeek(value);
  return value;
}
export function decodeGoalSettings(value: unknown): GoalSettings {
  const row = record(value);
  const effectiveDate = row.effectiveDate === null ? null : text(row.effectiveDate);
  if (effectiveDate !== null) getStudyDayBounds(effectiveDate);
  if ((row.scheduled === null) !== (effectiveDate === null)) return invalid();
  if (row.isFirstSetup !== undefined && typeof row.isFirstSetup !== 'boolean') return invalid();
  return { ...(row.isFirstSetup === undefined ? {} : { isFirstSetup: row.isFirstSetup }), current: decodeGoals(row.current), scheduled: row.scheduled === null ? null : decodeGoals(row.scheduled), effectiveDate };
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
export function decodeLeaveStatus(value: unknown): LeaveStatus {
  const row = record(value);
  if (!Array.isArray(row.grants)) return invalid();
  const weeks = new Set<string>();
  const grants = row.grants.map((item): LeaveGrant => {
    const grant = record(item);
    const kind = grant.kind === undefined ? 'reward' : text(grant.kind);
    if (kind === 'admin') {
      const scheduledDate = text(grant.scheduledDate);
      getStudyDayBounds(scheduledDate);
      if (grant.earningWeek !== null || grant.expiresAt !== null || !['SCHEDULED', 'USED'].includes(String(grant.status))) return invalid();
      const earnedAt = instant(grant.earnedAt);
      const approvedAt = instant(grant.approvedAt);
      if (Date.parse(approvedAt) < Date.parse(earnedAt)) return invalid();
      return { id: text(grant.id), kind, earningWeek: null, expiresAt: null, earnedAt, approvedAt, scheduledDate, status: grant.status as 'SCHEDULED' | 'USED' };
    }
    if (kind !== 'reward' && kind !== 'free') return invalid();
    const earningWeek = text(grant.earningWeek);
    const entitlement = `${earningWeek}:${kind}`;
    const { startMs } = getStudyDayBounds(earningWeek);
    const earnedAt = instant(grant.earnedAt);
    const expiresAt = instant(grant.expiresAt);
    if (new Date(`${earningWeek}T00:00:00Z`).getUTCDay() !== 1 || weeks.has(entitlement)
      || Date.parse(earnedAt) < startMs || Date.parse(earnedAt) > startMs + 7 * 86400000
      || Date.parse(expiresAt) <= Date.parse(earnedAt)) return invalid();
    weeks.add(entitlement);
    const status = text(grant.status) as LeaveState;
    if (!['AVAILABLE', 'SCHEDULED', 'USED', 'EXPIRED'].includes(status)) return invalid();
    const approvedAt = grant.approvedAt == null ? grant.approvedAt : instant(grant.approvedAt);
    if (approvedAt != null && (Date.parse(approvedAt) < Date.parse(earnedAt) || Date.parse(approvedAt) >= Date.parse(expiresAt))) return invalid();
    const scheduledDate = grant.scheduledDate === null ? null : text(grant.scheduledDate);
    if ((status === 'SCHEDULED' || status === 'USED') !== (scheduledDate !== null)) return invalid();
    if (scheduledDate !== null) {
      const scheduledMs = getStudyDayBounds(scheduledDate).startMs;
      if (scheduledMs >= Date.parse(expiresAt)) return invalid();
      if (scheduledMs < Date.parse(earnedAt) && (status !== 'USED' || !approvedAt || Date.parse(approvedAt) < scheduledMs || Date.parse(approvedAt) >= scheduledMs + 86400000)) return invalid();
    }
    return { ...(approvedAt === undefined ? {} : { approvedAt }), ...(grant.kind === undefined ? {} : { kind: kind as 'reward' | 'free' }), id: text(grant.id), earningWeek, earnedAt, expiresAt, status, scheduledDate };
  });
  const availableCount = seconds(row.availableCount);
  if (new Set(grants.map(g => g.id)).size !== grants.length
    || new Set(grants.flatMap(g => g.scheduledDate === null ? [] : [g.scheduledDate])).size !== grants.filter(g => g.scheduledDate !== null).length
    || availableCount !== grants.filter(g => g.status === 'AVAILABLE').length) return invalid();
  return { revision: seconds(row.revision), availableCount, grants };
}
