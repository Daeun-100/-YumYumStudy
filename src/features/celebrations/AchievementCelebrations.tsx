import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useIdentity } from '../../components/IdentityProvider';
import { useStartupVisible } from '../../components/StartupBoundary';
import { getHistory } from '../../data/study';
import { getLeaveStatus } from '../../data/leave';
import type { DayRecord } from '../../lib/contracts';
import { studyRoomId } from '../../lib/room';
import { getStudyDate } from '../../lib/study-day';
import { useStudy } from '../study/StudyProvider';
import { useStudyNow } from '../study/study-clock';
import { displayedSeconds } from '../study/presentation';
import { celebrationForProgress, celebrationForToday, createDailyCelebrationTracker, rewardCandidate, weekDates, type Celebration } from './model';
import { CelebrationToast } from './CelebrationToast';
import { ToastSlot, useToastEnvironment } from '../../design/toast';

const tracker = createDailyCelebrationTracker(AsyncStorage);
type Warm = { key: string; seen?: boolean; seenRead: Promise<boolean>; history?: DayRecord[]; historyRead: Promise<DayRecord[] | null> };
export function AchievementCelebrations() {
  const identity = useIdentity();
  const study = useStudy();
  const environment = useToastEnvironment();
  const startupVisible = useStartupVisible();
  const now = useStudyNow(environment.active);
  const [notice, setNotice] = useState<Celebration | null>(null);
  const flight = useRef(false), attempted = useRef(''), shown = useRef('');
  const generation = useRef(0), warm = useRef<Warm | null>(null);
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
  const seconds = snapshot ? displayedSeconds(snapshot.data.day, snapshot.data.activeSession, snapshot.serverNow, now || Date.parse(snapshot.serverNow)) : 0;
  const candidate = !!snapshot && snapshot.data.day.studyDate === date && !!snapshot.data.day.goalMinutes && snapshot.data.day.goalMinutes > 0 && seconds >= snapshot.data.day.goalMinutes * 60;
  useEffect(() => {
    const version = ++generation.current;
    attempted.current = ''; flight.current = false; warm.current = null;
    return () => { generation.current = version + 1; };
  }, [ready, scope, date]);
  // Prepare stamps and the duplicate marker before the goal crossing. No reward is inferred here.
  useEffect(() => {
    if (!ready || !identity.uid || !date || shown.current === `${scope}:${date}`) return;
    const entry = { key: viewKey } as Warm;
    entry.seenRead = tracker.wasStarted(identity.uid, studyRoomId, date).then(seen => { entry.seen = seen; return seen; });
    entry.historyRead = getHistory(weekDates(date)[0], date).then(history => { entry.history = history.data; return history.data; }).catch(() => null);
    warm.current = entry;
    // Screens without a timer consumer still need a fresh foreground/guard reconciliation.
    void confirmToday();
  }, [ready, scope, date, viewKey, identity.uid, confirmToday]);
  useEffect(() => {
    if (!ready || !candidate || !identity.uid || !snapshot || notice || shown.current === `${scope}:${date}`) return;
    const key = `${scope}:${date}:${snapshot.serverNow}`;
    if (flight.current || attempted.current === key) return;
    const uid = identity.uid, room = studyRoomId, requestGeneration = generation.current;
    const entry = warm.current?.key === viewKey ? warm.current : null;
    const valid = () => current.current.ready && current.current.scope === scope && generation.current === requestGeneration && getStudyDate(current.current.now) === date;
    const update = (result: Celebration) => {
      if (valid()) setNotice(previous => previous?.date === date ? result : previous);
    };
    let promotionSettled = false;
    flight.current = true; attempted.current = key;
    void (async () => {
      const seen = entry?.seen ?? await (entry?.seenRead ?? tracker.wasStarted(uid, room, date));
      if (!valid()) return;
      if (seen) { shown.current = `${scope}:${date}`; return; }
      // Only an already reconciled foreground snapshot may extrapolate live timer progress.
      const today = study.canCelebrateLive ? snapshot : await confirmToday();
      if (!today || !valid()) return;
      const progress = study.canCelebrateLive ? seconds : today.data.day.closedSeconds + today.data.day.runningSeconds;
      const first = celebrationForProgress(uid, date, today, entry?.history ?? [], progress);
      if (!first) return;
      setNotice({ ...first, rewardPending: rewardCandidate(first) });
      // Server work is now after the first stamp view. A failed reward read cannot hide it.
      const verifiedRead = study.canCelebrateLive ? confirmToday() : Promise.resolve(today);
      const historyRead = (async () => {
        // Warm history paints immediately; promotion uses a new read for remote edits/leaves.
        const history = (await getHistory(weekDates(date)[0], date)).data;
        const enriched = celebrationForProgress(uid, date, today, history, progress);
        if (enriched && !promotionSettled) update({ ...enriched, rewardPending: rewardCandidate(enriched) });
        return history;
      })();
      // Issuance is queried only after fresh guard/server confirmation.
      const leaveRead = verifiedRead.then(verified => verified ? getLeaveStatus() : null);
      const [verified, history, leave] = await Promise.all([verifiedRead, historyRead, leaveRead]);
      promotionSettled = true;
      if (!valid()) return;
      const result = verified && leave ? celebrationForToday(uid, date, verified, history, leave.data) : null;
      if (result) update({ ...result, rewardPending: false });
      else setNotice(previous => previous?.date === date ? { ...previous, rewardPending: false } : previous);
    })().catch(() => {
      promotionSettled = true;
      // A visible goal remains valid as a celebration; only reward promotion is abandoned.
      if (valid()) setNotice(previous => previous?.date === date ? { ...previous, rewardPending: false } : previous);
    }).finally(() => { if (requestGeneration === generation.current) flight.current = false; });
  }, [ready, candidate, seconds, identity.uid, snapshot, date, scope, viewKey, notice, confirmToday, study.canCelebrateLive]);
  if (!ready || !notice || notice.date !== date) return null;
  return <ToastSlot id={`achievement:${scope}:${notice.date}`} dedupeKey={`achievement:${scope}:${notice.date}`}
    onShow={() => { shown.current = `${scope}:${notice.date}`; void tracker.start(identity.uid!, studyRoomId, notice.date); }}
    onDismiss={() => setNotice(null)}>
    <CelebrationToast key={`${scope}:${notice.date}`} notice={notice} reducedMotion={environment.reducedMotion} screenReader={environment.screenReader} onDismiss={() => setNotice(null)} />
  </ToastSlot>;
}
