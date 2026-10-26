import type { DayRecord, LeaveGrant } from '../../lib/contracts.ts';
import { getStudyDayBounds } from '../../lib/study-day.ts';

export function reservationReason(date: string, today: string, grants: LeaveGrant[], now: number, changingId: string | null = null): string | null {
  if (date <= today) return '오늘과 지난 날짜에는 새로 예약할 수 없어요.';
  if (grants.some(g => g.id !== changingId && g.scheduledDate === date)) return '이미 연차가 예약된 날이에요.';
  const start = getStudyDayBounds(date).startMs;
  const eligible = grants.some(g => (changingId ? g.id === changingId && g.status === 'SCHEDULED' && !!g.scheduledDate && getStudyDayBounds(g.scheduledDate).startMs > now : g.status === 'AVAILABLE') && Date.parse(g.expiresAt) > start && Date.parse(g.expiresAt) > now);
  return eligible ? null : '이 날짜에 사용할 수 있는 연차가 없어요.';
}
export function weeklyAchievement(days: DayRecord[]): number {
  return Math.min(6, days.filter(day => day.attendance !== 'leave' && !day.isRestDay && day.goalMinutes !== null && day.goalMinutes > 0 && day.closedSeconds + day.runningSeconds >= day.goalMinutes * 60).length);
}
export const koreanDate = (instant: string) => new Date(Date.parse(instant) + 9 * 3600000).toISOString().slice(0, 10);
