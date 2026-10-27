import { useMemoryQuery } from '../../data/useMemoryQuery';
import { useIdentity } from '../../components/IdentityProvider';
import { useCallback, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useAndroidBack } from '../navigation/useAndroidBack';
import { View } from 'react-native';
import { getHistory } from '../../data/study';
import { getStudyDate } from '../../lib/study-day';
import { monthStart, parseDate, shiftDate, shiftMonth, weekStart } from '../records/model';
import { displayedSeconds } from '../study/presentation';
import { useStudy } from '../study/StudyProvider';
import { Nav, ui } from '../study/StudyUI';
import { LeaveView } from './LeaveView';
import { useLeave } from './LeaveProvider';
import { koreanDate, reservationReason, weeklyAchievement } from './model';

export function LeaveScreen() {
  const backRef = useRef<{ back(): boolean }>(null);
  useAndroidBack(() => {
    if (!backRef.current?.back()) router.dismissTo('/');
    return true;
  });
  const { profile } = useIdentity();
  const leave = useLeave();
  const study = useStudy();
  const [initialNow] = useState(() => Date.now());
  const today = study.today?.data.day.studyDate ?? getStudyDate(initialNow);
  const [month, setMonth] = useState(monthStart(today));
  const [notice, setNotice] = useState('');
  const changeMonth = useCallback((value: string) => setMonth(value), []);
  const version = `${study.today?.serverNow}:${leave.snapshot?.serverNow}`;
  const loadWeek = useCallback(() => { void version; return getHistory(weekStart(today), today); }, [today, version]);
  const end = shiftDate(shiftMonth(month, 1), -1);
  const loadCalendar = useCallback(() => { void version; return getHistory(month, end); }, [month, end, version]);
  const weekly = useMemoryQuery(['history', weekStart(today), today], loadWeek);
  const monthly = useMemoryQuery(['history', month, end], loadCalendar);
  const week = weekly.data?.data;
  const calendar = monthly.data?.data;
  const error = weekly.error || monthly.error;
  const snapshot = leave.snapshot;
  const now = Math.max(study.now, Date.parse(snapshot?.serverNow ?? study.today?.serverNow ?? new Date(initialNow).toISOString()));
  const grants = snapshot?.data.grants ?? [];
  const liveWeek = week?.map(day => {
    if (day.studyDate !== today || !study.today) return day;
    const current = study.today;
    const seconds = displayedSeconds(current.data.day, current.data.activeSession, current.serverNow, study.error ? Date.parse(current.serverNow) : now);
    return { ...current.data.day, closedSeconds: seconds, runningSeconds: 0 };
  });
  const calendarDays = Array.from({ length: parseDate(shiftDate(shiftMonth(month, 1), -1)).getUTCDate() }, (_, i) => {
    const date = shiftDate(month, i);
    const day = calendar?.find(day => day.studyDate === date);
    const reserved = grants.some(grant => grant.scheduledDate === date && (grant.status === 'SCHEDULED' || grant.status === 'USED'));
    return { date, minutes: (day?.closedSeconds ?? 0) / 60, goal: day?.goalMinutes ?? null,
      status: reserved ? 'leave' as const : day?.isRestDay ? 'rest' as const : 'empty' as const, sessions: [] };
  });
  return <View style={ui.outer}><View style={ui.page}>
    <LeaveView backRef={backRef} backBlocked={leave.busy} character={profile?.character ?? 'bunny'} today={today} grants={grants.map(grant => ({ id: grant.id, state: grant.status.toLowerCase() as 'available' | 'scheduled' | 'used' | 'expired', earned: koreanDate(grant.earnedAt), expires: koreanDate(grant.expiresAt), date: grant.scheduledDate ?? undefined }))}
      state={!snapshot ? leave.error ? 'error' : 'loading' : 'ready'} busy={leave.busy || leave.actionFailed || !!error} error={leave.error || error} notice={notice}
      weeklyDays={liveWeek ? weeklyAchievement(liveWeek) : null} weeklyLoading={!week && !error} calendarDays={calendarDays} calendarLoading={!calendar && !error}
      navigation={<Nav current="leave" />} onClearNotice={() => setNotice('')} onMonthChange={changeMonth}
      onRefresh={async () => { weekly.retry(); monthly.retry(); await Promise.all([leave.refresh(), study.refresh()]); }}
      unavailable={(date, changingId) => reservationReason(date, today, grants, now, changingId)}
      onApply={async (date, changingId) => { const ok = await leave.schedule(date, changingId); if (ok) setNotice(`${date} 연차를 ${changingId ? '변경' : '예약'}했어요.`); return ok; }}
      onCancel={async (id, date) => { const ok = await leave.cancel(id, date); if (ok) setNotice('예약을 취소했어요. 연차 1개가 돌아왔어요.'); return ok; }} />
  </View></View>;
}
