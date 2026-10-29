import type { TodayData } from './contracts';

/** Server timestamps and elapsed running seconds do not invalidate historical data. */
export function recordQueryVersion(data: Pick<TodayData, 'day' | 'activeSession'> | undefined, from: string, to: string): string {
  if (!data || data.day.studyDate < from || data.day.studyDate > to) return '';
  const { day, activeSession } = data;
  return JSON.stringify([day.studyDate, day.closedSeconds, day.goalMinutes, day.attendance, day.isRestDay,
    day.superWatermelon, activeSession?.id, activeSession?.startedAt, activeSession?.endedAt]);
}
