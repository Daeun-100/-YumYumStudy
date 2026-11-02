import type { Snapshot, TodayData } from './contracts.ts';
import { secondsInStudyDay } from './study-day.ts';

export type Receipt = { sentAt: number; receivedAt: number };
export type SessionTimeline = ReturnType<typeof createSessionTimeline>;
/** One conservative anchor per live session. Refreshes never replace it with a
 * different clock. The unmeasurable return-path delay is deliberately excluded. */
export function createSessionTimeline(sessionId: string, serverNow: string, receipt: Receipt, read: () => number) {
  const serverMs = Date.parse(serverNow);
  if (!Number.isFinite(serverMs) || !Number.isFinite(receipt.sentAt) || !Number.isFinite(receipt.receivedAt)
    || receipt.receivedAt < receipt.sentAt || receipt.receivedAt > read()) throw new Error('Invalid clock sample');
  // Diagnostic bound: slow samples never advance an existing live anchor.
  const reliable = receipt.receivedAt - receipt.sentAt <= 2000;
  return { sessionId, reliable, serverMs, receivedAt: receipt.receivedAt,
    now: () => serverMs + Math.max(0, read() - receipt.receivedAt) };
}
export function projectTimeline(snapshot: Snapshot<TodayData>, timeline: SessionTimeline | null): Snapshot<TodayData> {
  const session = snapshot.data.activeSession;
  if (!session || !timeline || timeline.sessionId !== session.id) return snapshot;
  const now = timeline.now();
  return { ...snapshot, serverNow: new Date(now).toISOString(), data: { ...snapshot.data,
    day: { ...snapshot.data.day, runningSeconds: secondsInStudyDay(session.startedAt, now, snapshot.data.day.studyDate) } } };
}
export function approvedGoal(day: { goalAchieved: boolean | null; closedSeconds: number; goalMinutes: number | null; confirmedGoalAchieved?: boolean | null }) {
  if (day.confirmedGoalAchieved !== undefined) return day.confirmedGoalAchieved === true;
  return (day.goalMinutes !== null && day.goalMinutes > 0 && day.closedSeconds >= day.goalMinutes * 60);
}
