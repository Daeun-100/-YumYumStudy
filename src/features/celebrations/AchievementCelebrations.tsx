import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useIdentity } from '../../components/IdentityProvider';
import { useStartupVisible } from '../../components/StartupBoundary';
import { getHistory } from '../../data/study';
import { getLeaveStatus } from '../../data/leave';
import { studyRoomId } from '../../lib/room';
import { getStudyDate } from '../../lib/study-day';
import { useStudy } from '../study/StudyProvider';
import { useStudyNow } from '../study/study-clock';
import { displayedSeconds } from '../study/presentation';
import { celebrationForToday, createDailyCelebrationTracker, weekDates, type Celebration } from './model';
import { CelebrationToast } from './CelebrationToast';
import { useToastEnvironment } from './useToastEnvironment';

const tracker = createDailyCelebrationTracker(AsyncStorage);
export function AchievementCelebrations() {
  const identity = useIdentity();
  const study = useStudy();
  const environment = useToastEnvironment();
  const startupVisible = useStartupVisible();
  const now = useStudyNow(environment.active);
  const [notice, setNotice] = useState<Celebration | null>(null);
  const flight = useRef(false);
  const attempted = useRef('');
  const shown = useRef('');
  const generation = useRef(0);
  const ready = startupVisible && environment.ready && environment.active && !environment.blocked && study.startupReady && !identity.loading && !identity.error && !study.busy && !study.actionFailed;
  const scope = `${studyRoomId}:${identity.uid ?? ''}`;
  const current = useRef({ ready, scope, now });
  useLayoutEffect(() => { current.current = { ready, scope, now }; }, [ready, scope, now]);
  const confirmToday = study.confirmToday;
  const snapshot = study.today;
  const date = now ? getStudyDate(now) : snapshot?.data.day.studyDate ?? '';
  const viewKey = `${ready}:${scope}:${date}`;
  const [previousView, setPreviousView] = useState(viewKey);
  if (previousView !== viewKey) { setPreviousView(viewKey); setNotice(null); }
  const candidate = !!snapshot && !!date && snapshot.data.day.studyDate === date && snapshot.data.day.goalMinutes !== null && snapshot.data.day.goalMinutes > 0
    && displayedSeconds(snapshot.data.day, snapshot.data.activeSession, snapshot.serverNow, now || Date.parse(snapshot.serverNow)) >= snapshot.data.day.goalMinutes * 60;
  useEffect(() => {
    generation.current++; attempted.current = ''; flight.current = false;
  }, [ready, scope, date]);
  useEffect(() => {
    if (!ready || !candidate || !identity.uid || !snapshot || notice || shown.current === `${scope}:${date}`) return;
    const key = `${scope}:${date}:${snapshot.serverNow}`;
    if (flight.current || attempted.current === key) return;
    const uid = identity.uid, room = studyRoomId, requestGeneration = generation.current;
    const valid = () => current.current.ready && current.current.scope === scope && generation.current === requestGeneration
      && getStudyDate(current.current.now) === date;
    flight.current = true; attempted.current = key;
    void (async () => {
      if (await tracker.wasStarted(uid, room, date) || !valid()) { if (valid()) shown.current = `${scope}:${date}`; return; }
      const today = await confirmToday();
      if (!today || !valid()) return;
      // These reads also recover a lazily issued reward. No notification data is written to the server.
      const [history, leave] = await Promise.all([getHistory(weekDates(date)[0], date), getLeaveStatus()]);
      if (!valid()) return;
      const result = celebrationForToday(uid, date, today, history.data, leave.data);
      if (!result) return;
      // Mark only when a real view is about to start; a blocked view must remain eligible.
      if (!valid()) return;
      shown.current = `${scope}:${date}`;
      setNotice(result);
      void tracker.start(uid, room, date);
    })().catch(() => { /* A later confirmed snapshot or foreground entry retries within this day. */ }).finally(() => { if (requestGeneration === generation.current) flight.current = false; });
  }, [ready, candidate, identity.uid, snapshot, date, scope, notice, confirmToday]);
  if (!ready || !notice || notice.date !== date) return null;
  return <View pointerEvents="box-none" style={s.host}>
    <CelebrationToast key={`${scope}:${notice.date}`} notice={notice} reducedMotion={environment.reducedMotion} screenReader={environment.screenReader}
      onDismiss={() => setNotice(null)} onViewReward={() => { setNotice(null); router.navigate('/leave'); }} />
  </View>;
}
const s = StyleSheet.create({ host: { position: 'absolute', top: 8, left: 16, right: 16, zIndex: 100, elevation: 12 } });
