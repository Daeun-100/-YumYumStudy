import type { LeaveStatus, Snapshot, TodayData } from './contracts.ts';
import { getStudyDate, getStudyDayBounds, secondsInStudyDay } from './study-day.ts';
// Stable keys: a running timer does not turn into per-second RPC calls.
export function leaveRefreshKey(today: Snapshot<TodayData> | null, now: number, leave: Snapshot<LeaveStatus> | null): string {
  if (!today || !now) return '';
  const day = today.data.day;
  const session = today.data.activeSession;
  const extra = session ? Math.max(0, secondsInStudyDay(session.startedAt, now, day.studyDate) - secondsInStudyDay(session.startedAt, today.serverNow, day.studyDate)) : 0;
  const achieved = day.attendance !== 'leave' && day.goalMinutes !== null && day.goalMinutes > 0 && day.closedSeconds + day.runningSeconds + extra >= day.goalMinutes * 60;
  const due = leave?.data.grants.filter(g => (g.status === 'AVAILABLE' && now >= Date.parse(g.expiresAt))
    || (g.status === 'SCHEDULED' && g.scheduledDate && now >= getStudyDayBounds(g.scheduledDate).startMs)).map(g => g.id).sort().join(',') ?? '';
  return `${getStudyDate(now)}:${achieved ? day.studyDate : ''}:${due}`;
}
