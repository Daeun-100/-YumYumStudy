import type { StudySession } from '../../lib/contracts.ts';
import { getStudyDayBounds, secondsInStudyDay } from '../../lib/study-day.ts';

const clock = (ms: number) => new Date(ms + 9 * 3600000).toISOString().slice(11, 19);
export function recordSessions(sessions: StudySession[], date: string, now: number) {
  const { startMs, endMs } = getStudyDayBounds(date);
  return sessions.filter(session => Date.parse(session.startedAt) < endMs && Date.parse(session.endedAt ?? new Date(now).toISOString()) > startMs)
    .map(session => {
      const start = Math.max(Date.parse(session.startedAt), startMs);
      const end = Math.min(Date.parse(session.endedAt ?? new Date(now).toISOString()), endMs);
      return { start: clock(start), end: !session.endedAt && now < endMs ? '공부 중' : clock(end), minutes: secondsInStudyDay(session.startedAt, session.endedAt ?? now, date) / 60 };
    });
}

/** Advance a minute-resolution summary only for its live detail, capped at 06:00 KST. */
export function liveRecordMinutes(day: { date: string; minutes: number; asOf?: number }, now: number, running: boolean) {
  if (!running || day.asOf === undefined) return day.minutes;
  const { endMs } = getStudyDayBounds(day.date);
  return day.minutes + Math.max(0, Math.min(now, endMs) - day.asOf) / 60000;
}
