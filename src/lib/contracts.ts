import type { CharacterId } from './characters.ts';
export type UID = string;
export type StudyDate = string;

export type Profile = { id: UID; displayName: string; character?: CharacterId; activeSkinId?: string | null; skinUpdatedAt?: string };
export type StudySession = {
  id: string;
  userId: UID;
  startedAt: string;
  endedAt: string | null;
};
export type GoalWeek = [number | null, number | null, number | null, number | null, number | null, number | null, number | null];
export type DayRecord = {
  studyDate: StudyDate;
  closedSeconds: number;
  // Snapshot-only portion of an unclosed session; never include in closedSeconds.
  runningSeconds: number;
  goalMinutes: number | null;
  attendance: 'present' | 'absent' | 'pending' | 'leave';
  isRestDay: boolean;
  goalAchieved: boolean | null;
};
export type GoalSettings = { isFirstSetup?: boolean; current: GoalWeek; scheduled: GoalWeek | null; effectiveDate: StudyDate | null };
export type LeaveState = 'AVAILABLE' | 'SCHEDULED' | 'USED' | 'EXPIRED';
// Missing kind in older server responses means reward.
export type LeaveGrant = { approvedAt?: string | null; kind?: 'reward' | 'free'; status: LeaveState; scheduledDate: StudyDate | null; id: string; earningWeek: StudyDate; earnedAt: string; expiresAt: string };
// Each grant belongs to exactly one state; only AVAILABLE contributes to the balance.
export type LeaveStatus = { revision: number; availableCount: number; grants: LeaveGrant[] };
export type RoomMember = { profile: Profile; today: DayRecord; activeSession: StudySession | null };
export type Snapshot<T> = { serverNow: string; data: T };
export type TodayData = { profile: Profile; day: DayRecord; activeSession: StudySession | null };
export type ConnectionState = 'connecting' | 'connected' | 'disconnected';
export type StudyErrorCode = 'NETWORK' | 'UNAUTHORIZED' | 'VALIDATION' | 'POLICY_PENDING' | 'NOT_CONFIGURED' | 'UNKNOWN';

export class StudyError extends Error {
  readonly code: StudyErrorCode;
  constructor(code: StudyErrorCode, message: string) {
    super(message);
    this.name = 'StudyError';
    this.code = code;
  }
}

export function toStudyError(error: unknown): StudyError {
  if (error instanceof StudyError) return error;
  if (error && typeof error === 'object') {
    const value = error as { name?: string; status?: number };
    if (value.name === 'AuthRetryableFetchError' || value.name === 'AbortError' || value.name === 'TimeoutError' || error instanceof TypeError) {
      return new StudyError('NETWORK', '서버에 연결하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');
    }
    if (value.status === 401 || value.status === 403) {
      return new StudyError('UNAUTHORIZED', '기존 인증을 확인하지 못했습니다. 새 UID를 만들지 않고 중단했습니다.');
    }
  }
  return new StudyError('UNKNOWN', '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
}

export function validateGoalWeek(value: unknown): asserts value is GoalWeek {
  if (!Array.isArray(value) || value.length !== 7 || !Array.from(value).every((minutes) => minutes === null || (Number.isSafeInteger(minutes) && minutes >= 0 && minutes <= 1440))) {
    throw new StudyError('VALIDATION', '요일별 목표는 월요일부터 7개의 0~1,440분 정수 또는 미설정 값이어야 합니다.');
  }
}
