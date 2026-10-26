import { StudyError } from './contracts.ts';
import type { DayRecord } from './contracts.ts';
import { getStudyDayBounds } from './study-day.ts';

// Re-evaluate from a server-anchored clock while a timer is running on screen.
export function deriveDayStatus(
  date: string, goalMinutes: number | null, closedSeconds: number, runningSeconds: number, nowMs: number, hasLeave = false,
): Pick<DayRecord, 'attendance' | 'isRestDay' | 'goalAchieved'> {
  const { startMs, endMs } = getStudyDayBounds(date);
  if (![closedSeconds, runningSeconds].every((n) => Number.isSafeInteger(n) && n >= 0)
    || !Number.isFinite(nowMs)
    || (goalMinutes !== null && (!Number.isInteger(goalMinutes) || goalMinutes < 0 || goalMinutes > 1440))) {
    throw new StudyError('VALIDATION', '출석 계산에 필요한 시간과 목표를 확인해 주세요.');
  }
  const total = closedSeconds + runningSeconds;
  return {
    attendance: hasLeave && nowMs >= startMs ? 'leave' : total >= 1 ? 'present' : nowMs >= endMs ? 'absent' : 'pending',
    isRestDay: goalMinutes === 0,
    goalAchieved: goalMinutes !== null && goalMinutes > 0 ? total >= goalMinutes * 60 : null,
  };
}
