import type { DayRecord, StudySession } from '../../lib/contracts.ts';
import { secondsInStudyDay } from '../../lib/study-day.ts';

export function displayedSeconds(day: DayRecord, session: StudySession | null, serverNow: string, now: number): number {
  const added = session ? Math.max(0, secondsInStudyDay(session.startedAt, now, day.studyDate) - secondsInStudyDay(session.startedAt, serverNow, day.studyDate)) : 0;
  return day.closedSeconds + day.runningSeconds + added;
}
export function duration(seconds: number, showSeconds = true): string {
  const minutes = Math.floor(seconds / 60);
  const label = minutes >= 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`;
  return showSeconds ? timer(seconds) : label;
}
export function timer(seconds: number): string {
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, Math.floor(seconds) % 60].map(n => String(n).padStart(2, '0')).join(':');
}
export function goalLabel(minutes: number | null): string {
  return minutes === null ? '목표 미설정' : minutes === 0 ? '오늘은 휴무' : `오늘 목표 ${duration(minutes * 60, false)}`;
}
export function progress(seconds: number, minutes: number | null): number | null {
  return minutes === null || minutes === 0 ? null : Math.floor(seconds / (minutes * 60) * 100);
}
