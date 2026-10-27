import type { Snapshot, TodayData } from '../../lib/contracts.ts';
import { secondsInStudyDay } from '../../lib/study-day.ts';

// A late server snapshot may already contain time AFTER the native departure.
export function applyDeparture(snapshot: Snapshot<TodayData>, sessionId: string, endedAt: string): Snapshot<TodayData> {
  const { day, activeSession } = snapshot.data;
  if (activeSession?.id !== sessionId) return snapshot;
  const before = secondsInStudyDay(activeSession.startedAt, snapshot.serverNow, day.studyDate);
  const after = secondsInStudyDay(activeSession.startedAt, endedAt, day.studyDate);
  return { ...snapshot, data: { ...snapshot.data, activeSession: null,
    day: { ...day, closedSeconds: Math.max(day.closedSeconds, day.closedSeconds + day.runningSeconds + after - before), runningSeconds: 0 } } };
}
