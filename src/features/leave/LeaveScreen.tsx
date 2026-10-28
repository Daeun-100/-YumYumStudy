import { recordQueryVersion } from '../../lib/record-query-version';
import { useScreenNow } from '../study/useScreenNow';
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
import { ui } from '../study/StudyUI';
import { LeaveView } from './LeaveView';
import { useLeave } from './LeaveProvider';
import { koreanDate, reservationReason, weeklyAchievement } from './model';

export function LeaveScreen() {
  const backRef = useRef<{ back(): boolean }>(null);
  useAndroidBack(() => {
    if (!backRef.current?.back()) router.navigate('/');
    return true;
  });
  const { profile } = useIdentity();
  const leave = useLeave();
  const study = useStudy();
  const studyNow = useScreenNow();
  const [initialNow] = useState(() => Date.now());
  const today = getStudyDate(studyNow || Date.parse(leave.snapshot?.serverNow ?? study.today?.serverNow ?? new Date(initialNow).toISOString()));
  const [month, setMonth] = useState(monthStart(today));
  const [notice, setNotice] = useState('');
  const changeMonth = useCallback((value: string) => setMonth(value), []);
  const version = recordQueryVersion(study.today?.data, weekStart(today), today);
  const loadWeek = useCallback(() => { void version; return getHistory(weekStart(today), today); }, [today, version]);
  const end = shiftDate(shiftMonth(month, 1), -1);
  const loadCalendar = useCallback(() => { void version; return getHistory(month, end); }, [month, end, version]);
  const weekly = useMemoryQuery(['history', weekStart(today), today], loadWeek, { version });
  const monthly = useMemoryQuery(['history', month, end], loadCalendar, { version: recordQueryVersion(study.today?.data, month, end), staleTime: end < today ? 300000 : 30000 });
  const week = weekly.data?.data;
  const calendar = monthly.data?.data;
  const error = weekly.error || monthly.error;
  const snapshot = leave.snapshot;
  const now = Math.max(studyNow, Date.parse(snapshot?.serverNow ?? study.today?.serverNow ?? new Date(initialNow).toISOString()));
  const grants = snapshot?.data.grants ?? [];
  const liveWeek = week?.map(source => {
    const day = grants.some(g => g.scheduledDate === source.studyDate) ? { ...source, attendance: 'leave' as const } : source;
    if (day.studyDate !== today || !study.today) return day;
    const current = study.today;
    if (current.data.day.studyDate !== today) return day;
    const seconds = displayedSeconds(current.data.day, current.data.activeSession, current.serverNow, study.error ? Date.parse(current.serverNow) : now);
    return { ...current.data.day, attendance: grants.some(g => g.scheduledDate === today) ? 'leave' as const : current.data.day.attendance, closedSeconds: seconds, runningSeconds: 0 };
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
      state={!snapshot ? leave.error ? 'error' : 'loading' : 'ready'} busy={leave.busy || leave.actionFailed || !!error} error={leave.error || error} notice={notice || (weekly.cached || monthly.cached ? '저장된 공부 기록을 보여드리고 있어요. 최신 기록을 확인 중이에요.' : '')}
      weeklyDays={liveWeek ? weeklyAchievement(liveWeek) : null} weeklyLoading={!week && !error} calendarDays={calendarDays} calendarLoading={!calendar && !error}
      navigation={null} onClearNotice={() => setNotice('')} onMonthChange={changeMonth}
      onRefresh={async () => { weekly.retry(); monthly.retry(); await Promise.all([leave.refresh(), study.refresh()]); }}
      unavailable={(date, changingId) => reservationReason(date, today, grants, now, changingId, liveWeek)}
      onApply={async (date, changingId) => { const ok = await leave.schedule(date, changingId); if (ok) setNotice(date === today ? changingId ? '예약을 오늘로 변경하고 연차를 사용했어요.' : '오늘 연차를 사용했어요.' : `${date} 연차를 ${changingId ? '변경' : '예약'}했어요.`); return ok; }}
      onCancel={async (id, date) => { const ok = await leave.cancel(id, date); if (ok) setNotice('예약을 취소했어요. 연차 1개가 돌아왔어요.'); return ok; }} />
  </View></View>;
}
