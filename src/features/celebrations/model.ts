import type { DayRecord, LeaveStatus, Snapshot, TodayData } from '../../lib/contracts.ts';
import { getStudyDate } from '../../lib/study-day.ts';

export type StampDay = { date: string; achieved: boolean; rest: boolean; leave: boolean };
export type Celebration = { date: string; todayIndex: number; days: StampDay[]; reward: boolean };
export function weekDates(date: string): string[] {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, index) => new Date(day.getTime() + index * 86400000).toISOString().slice(0, 10));
}
export function goalReached(day: DayRecord): boolean {
  return day.goalMinutes !== null && day.goalMinutes > 0 && day.closedSeconds + day.runningSeconds >= day.goalMinutes * 60;
}

/** Only server-confirmed, current-study-day facts may produce a celebration. */
export function celebrationForToday(uid: string, date: string, today: Snapshot<TodayData>, history: DayRecord[], leave: LeaveStatus): Celebration | null {
  const current = today.data.day;
  if (today.data.profile.id !== uid || current.studyDate !== date || getStudyDate(today.serverNow) !== date || !goalReached(current)) return null;
  const dates = weekDates(date);
  const records = new Map(history.map(day => [day.studyDate, day]));
  records.set(date, current);
  const days = dates.map(value => {
    const day = records.get(value);
    return { date: value, achieved: value <= date && !!day && goalReached(day), rest: day?.isRestDay ?? false, leave: day?.attendance === 'leave' };
  });
  const eligible = days.filter(day => day.achieved && !day.leave).length;
  const earnedToday = leave.grants.some(grant => (grant.kind ?? 'reward') === 'reward'
    && grant.earningWeek === dates[0] && getStudyDate(grant.earnedAt) === date && grant.status !== 'EXPIRED');
  return { date, days, todayIndex: dates.indexOf(date), reward: !days[dates.indexOf(date)].leave && eligible === 6 && earnedToday };
}

type Storage = { getItem(key: string): string | null | Promise<string | null>; setItem(key: string, value: string): void | Promise<void> };
/** Stores a date marker only, never an unread queue or notification contents. */
export function createDailyCelebrationTracker(storage: Storage) {
  const started = new Map<string, string>();
  const key = (uid: string, room: number) => `celebration-started-${room}-${uid}`;
  return {
    async wasStarted(uid: string, room: number, date: string) {
      const id = key(uid, room);
      if (started.get(id) === date) return true;
      try { return await storage.getItem(id) === date; } catch { return false; }
    },
    async start(uid: string, room: number, date: string) {
      const id = key(uid, room);
      started.set(id, date);
      try { await storage.setItem(id, date); } catch { /* Memory still prevents same-run repeats. */ }
    },
  };
}
