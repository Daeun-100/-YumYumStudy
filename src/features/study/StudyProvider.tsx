import { createStudyResourceDemand } from '../../lib/study-resource-demand';
import { StudyResourceContext } from './study-resources';
import { useResourceRefresh } from '../../hooks/useResourceRefresh';
import { useAppActive } from '../../hooks/useAppActive';
import { invalidateRecordQueries } from '../../data/query-cache';
import { StudyClockContext } from './study-clock';
import { createStudyClock } from '../../lib/study-clock';
import { createSharedRequest } from '../../lib/shared-request';
import { finishTiming, measure } from '../../lib/performance';
import { needsStudyGuard } from './timer-mode-core';
import { actionConfirmed } from './pending-action';
import { AppState, Platform } from 'react-native';
import { withTimeout } from '../../lib/with-timeout';
import { studyGuard } from '../allowed-apps/native';
import { applyDeparture } from './guard-core';
import { basicStudyMode, guardTransport, reconcileAndroidGuard } from './android-guard';
import { studyRoomId, withRoomOperation } from '../../lib/room';
import { createContext, useCallback, useContext, useEffect, useRef, useState, useMemo, useSyncExternalStore, useLayoutEffect, type PropsWithChildren } from 'react';
import { isAppActive } from '../../hooks/useRefreshOnResume';
import { getRoom, getToday, resumePendingStudyStart, startStudy, stopStudy, subscribeStudyChanges } from '../../data/study';
import { useIdentity } from '../../components/IdentityProvider';
import { displayedSeconds } from './presentation';
import { createServerClock } from '../../lib/clock';
import { getStudyDate } from '../../lib/study-day';
import { toStudyError, type RoomMember, type Snapshot, type TodayData } from '../../lib/contracts';

type State = { today: Snapshot<TodayData> | null; room: Snapshot<RoomMember[]> | null; loading: boolean; roomLoading: boolean; busy: boolean; error: string | null; roomError: string | null; actionFailed: boolean; startupReady: boolean; startupError: string | null; retryStartup(): Promise<void>; refresh(): Promise<void>; confirmToday(): Promise<Snapshot<TodayData> | null>; refreshRoom(): Promise<void>; toggle(): Promise<boolean> };
const Context = createContext<State | null>(null);
export function StudyProvider({ children }: PropsWithChildren) {
  const identity = useIdentity();
  const [today, setToday] = useState<State['today']>(null);
  const [room, setRoom] = useState<State['room']>(null);
  const updateProfile = identity.updateProfile;
  const ownerId = identity.profile?.id;
  const scope = !identity.loading && ownerId ? `${studyRoomId}:${ownerId}` : '';
  const currentScope = useRef(scope);
  useLayoutEffect(() => { currentScope.current = scope; }, [scope]);
  const [demand] = useState(createStudyResourceDemand);
  const consumers = useSyncExternalStore(demand.subscribe, demand.read, demand.read);
  const observesToday = consumers.today > 0, observesRoom = consumers.room > 0;
  const active = useAppActive();
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const connectionKey = `${scope}:${active}:${observesToday}:${observesRoom}`;
  const [previousConnectionKey, setPreviousConnectionKey] = useState(connectionKey);
  if (previousConnectionKey !== connectionKey) { setPreviousConnectionKey(connectionKey); setRealtimeConnected(false); }
  useEffect(() => {
    const mine = room?.data.find(member => member.profile.id === ownerId)?.profile;
    if (mine) updateProfile(mine);
  }, [room, ownerId, updateProfile]);
  useEffect(() => {
    if (today && today.data.profile.id === ownerId) updateProfile(today.data.profile);
  }, [today, ownerId, updateProfile]);
  const [time] = useState(createStudyClock);
  const setNow = time.set;
  const [loading, setLoading] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [actionFailed, setActionFailed] = useState(false);
  const [startupReady, setStartupReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const previousStudyDate = useRef<string | undefined>(undefined);
  const studyDate = today?.data.day.studyDate;
  useEffect(() => {
    if (previousStudyDate.current && studyDate && previousStudyDate.current !== studyDate) invalidateRecordQueries(studyRoomId);
    previousStudyDate.current = studyDate;
  }, [studyDate]);
  const latestSnapshot = useRef<State['today']>(null);
  const confirmedSnapshot = useRef<State['today']>(null);
  useEffect(() => { latestSnapshot.current = today; }, [today]);
  const clock = useRef<(() => number) | null>(null);
  const lock = useRef(false);
  const pending = useRef<{ type: 'start' } | { type: 'stop'; id: string } | null>(null);
  const sequence = useRef(0);
  const generation = useRef(0);
  const sharedRefresh = useRef(createSharedRequest());
  const sharedRoomRefresh = useRef(createSharedRequest());
  const roomSequence = useRef(0);
  const startupFlight = useRef<Promise<void> | null>(null);
  const startupAttempt = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [previousScope, setPreviousScope] = useState(scope);
  if (previousScope !== scope) {
    setPreviousScope(scope); setToday(null); setRoom(null); setError(null); setRoomError(null);
    setStartupReady(false); setStartupError(null);
  }
  useLayoutEffect(() => {
    generation.current++; sequence.current++; roomSequence.current++;
    startupFlight.current = null;
    clock.current = null; latestSnapshot.current = null; confirmedSnapshot.current = null;
  }, [scope]);
  // Friend requests have their own lifetime: neither slow friends nor a timer
  // mutation may hold up applying the authenticated owner's snapshot.
  const loadRoom = useCallback((changed = false): Promise<void> => {
    if (!scope) return Promise.resolve();
    const requestedGeneration = generation.current;
    return sharedRoomRefresh.current(requestedGeneration, async () => {
      if (requestedGeneration !== generation.current || currentScope.current !== scope) return;
      const request = ++roomSequence.current;
      setRoomLoading(true);
      try {
        const snapshot = await withTimeout(getRoom(), 15000, '친구 현황을 불러오지 못했어요. 다시 시도해 주세요.');
        if (!alive.current || request !== roomSequence.current || requestedGeneration !== generation.current || currentScope.current !== scope) return;
        setRoom(snapshot); setRoomError(null);
      } catch (failure) {
        if (alive.current && request === roomSequence.current && requestedGeneration === generation.current && currentScope.current === scope) setRoomError(toStudyError(failure).message);
        throw failure;
      } finally {
        if (alive.current && request === roomSequence.current && currentScope.current === scope) setRoomLoading(false);
      }
    }, changed);
  }, [scope]);
  const loadToday = useCallback((changed = false): Promise<void> => {
    if (!scope || lock.current) return Promise.resolve();
    const owner = ownerId!;
    const requestedGeneration = generation.current;
    return sharedRefresh.current(requestedGeneration, () => measure('study.refresh', async () => {
      if (lock.current || requestedGeneration !== generation.current || currentScope.current !== scope) return;
      const request = ++sequence.current;
      confirmedSnapshot.current = null;
      setLoading(true);
      if (Platform.OS === 'android' && studyGuard && latestSnapshot.current) {
        try {
          const status = await withTimeout(studyGuard.status(), 5000, '휴대폰 설정 확인이 지연되고 있어요. 다시 시도해 주세요.');
          const link = status.link;
          if (link?.endedAt && link.ownerId === owner && link.roomId === studyRoomId && request === sequence.current) {
            const stopped = applyDeparture(latestSnapshot.current, link.sessionId, link.endedAt);
            latestSnapshot.current = stopped; setToday(stopped);
          }
        } catch { /* Continue to server reconciliation; no session is started here. */ }
      }
      try {
        let snapshot = await withTimeout(getToday(), 15000, '공부 기록을 불러오지 못했어요. 다시 시도해 주세요.');
        if (!alive.current || request !== sequence.current || requestedGeneration !== generation.current || currentScope.current !== scope) return;
        try {
          const guarded = await measure('study.reconcile', () => withTimeout(withRoomOperation(() => reconcileAndroidGuard(snapshot)), 10000, '휴대폰 공부 기록 동기화가 지연되고 있어요. 다시 시도해 주세요.'));
          snapshot = guarded.snapshot;
          if (request === sequence.current && requestedGeneration === generation.current && currentScope.current === scope) confirmedSnapshot.current = snapshot;
        } catch { /* Native status is not a server error and stays out of the home banner. */ }
        if (!alive.current || request !== sequence.current || requestedGeneration !== generation.current || currentScope.current !== scope) return;
        clock.current = createServerClock(snapshot.serverNow);
        latestSnapshot.current = snapshot;
        setNow(clock.current()); setToday(snapshot);
        if (actionConfirmed(pending.current, snapshot.data.activeSession?.id ?? null)) {
          pending.current = null; setActionFailed(false);
        }
        if (!pending.current) setError(null);
      } catch (failure) {
        if (alive.current && request === sequence.current && currentScope.current === scope && !pending.current) setError(toStudyError(failure).message);
        throw failure;
      } finally {
        if (alive.current && request === sequence.current && currentScope.current === scope) setLoading(false);
      }
    }), changed);
  }, [scope, ownerId, setNow]);
  const todayObservation = useResourceRefresh({ scope: `${scope}:today`, enabled: !!scope && startupReady && observesToday, connected: true, refresh: loadToday });
  const roomObservation = useResourceRefresh({ scope: `${scope}:room`, enabled: !!scope && startupReady && observesRoom, connected: realtimeConnected, refresh: loadRoom });
  const markTodayFresh = todayObservation.markFresh, markRoomFresh = roomObservation.markFresh;
  const requestToday = todayObservation.request, requestRoom = roomObservation.request;
  // Explicit reads and mutation recovery do not depend on screen demand.
  const refresh = useCallback(async () => { try { await loadToday(); markTodayFresh(); } catch { /* State exposes the error. */ } }, [loadToday, markTodayFresh]);
  // A celebration cannot rely on a stale running timer or a failed guard recovery.
  const confirmToday = useCallback(async () => {
    if (!scope || lock.current) return null;
    const requestedGeneration = generation.current;
    try {
      await loadToday(); markTodayFresh();
      return currentScope.current === scope && requestedGeneration === generation.current && !lock.current && !pending.current ? confirmedSnapshot.current : null;
    } catch { return null; }
  }, [scope, loadToday, markTodayFresh]);
  const refreshRoom = useCallback(async () => { try { await loadRoom(); markRoomFresh(); } catch { /* State exposes the error. */ } }, [loadRoom, markRoomFresh]);
  const retryStartup = useCallback((): Promise<void> => {
    if (!scope) return Promise.resolve();
    if (startupFlight.current) return startupFlight.current;
    startupAttempt.current++;
    setStartupReady(false); setStartupError(null);
    const promise = measure('startup.study', async () => {
      try {
        await measure('startup.recover', () => withTimeout(resumePendingStudyStart(), 20000, '이전 공부 기록을 확인하지 못했어요. 다시 시도해 주세요.'));
        if (demand.read().room && isAppActive()) void refreshRoom();
        await refresh();
        if (alive.current && currentScope.current === scope) setStartupReady(true);
      } catch (failure) {
        if (alive.current && currentScope.current === scope) setStartupError(toStudyError(failure).message);
        throw failure;
      }
    }).catch(() => { /* StartupBoundary exposes the retry action. */ }).finally(() => {
      if (startupFlight.current === promise) startupFlight.current = null;
    });
    startupFlight.current = promise;
    return promise;
  }, [refresh, refreshRoom, demand, scope]);
  useEffect(() => {
    const attempt = startupAttempt.current;
    const initial = setTimeout(() => { if (startupAttempt.current === attempt) void retryStartup(); }, 0);
    return () => clearTimeout(initial);
  }, [retryStartup]);
  useEffect(() => {
    if (!scope || !startupReady || !active || (!observesToday && !observesRoom)) return;
    let disposed = false;
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeStudyChanges(changedOwner => {
        if (disposed || currentScope.current !== scope) return;
        if (observesRoom) void requestRoom(true);
        if (observesToday && (!changedOwner || changedOwner === ownerId)) void requestToday(true);
      }, state => { if (!disposed) setRealtimeConnected(state === 'connected'); });
    } catch { /* Resource-local fallback polling remains available. */ }
    return () => { disposed = true; unsubscribe(); };
  }, [scope, ownerId, startupReady, active, observesToday, observesRoom, requestToday, requestRoom]);
  useEffect(() => {
    let requestedDate = '';
    const tick = setInterval(() => {
      if (!clock.current) return;
      const value = clock.current(); setNow(value);
      const date = getStudyDate(value);
      if (today && today.data.day.studyDate !== date && requestedDate !== date && isAppActive()) {
        requestedDate = date;
        if (demand.read().today) void requestToday(true);
        if (demand.read().room) void requestRoom(true);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [today, demand, requestToday, requestRoom, setNow]);
  useEffect(() => {
    const guard = studyGuard;
    if (Platform.OS !== 'android' || !guard || !startupReady) return;
    let previous = '';
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active' || lock.current) return;
      void guard.status().then(status => {
        const key = JSON.stringify(status.link);
        if (key !== previous && !lock.current) { previous = key; void refresh(); }
      }).catch(() => { /* The next foreground refresh reports native failures. */ });
    }, 1000);
    return () => clearInterval(timer);
  }, [refresh, startupReady]);
  const toggle = useCallback(async () => {
    if (lock.current || !startupReady || !today || identity.loading || identity.error) return false;
    const finish = finishTiming('timer.toggle');
    let succeeded = false;
    lock.current = true; generation.current++; sequence.current++; setBusy(true); setError(null);
    const action = pending.current ?? (today.data.activeSession ? { type: 'stop' as const, id: today.data.activeSession.id } : { type: 'start' as const });
    let prepared = false;
    let requestingServer = false;
    try {
      if (Platform.OS === 'android' && studyGuard) {
        // Finish old guarded departures before choosing the next session's mode.
        if (action.type === 'start') {
          const status = await measure('timer.status', () => withTimeout(studyGuard!.status(), 3000, '휴대폰 설정 확인 지연')).catch(() => null);
          const basic = await basicStudyMode.get(identity.profile!.id);
          if (status?.link && status.link.ownerId === identity.profile!.id && status.link.roomId === studyRoomId && !status.link.confirmed && !basic) {
            await withTimeout(withRoomOperation(() => reconcileAndroidGuard(today)), 10000, '이전 공부 기록 확인이 지연되고 있어요. 다시 시도해 주세요.');
          }
          if (!needsStudyGuard(status, basic)) {
            await basicStudyMode.set(identity.profile!.id, '*');
          } else {
            if (status?.link?.endedAt && !status.link.confirmed) throw new Error('이전 공부의 일시정지를 동기화한 뒤 다시 시작해 주세요.');
            await measure('timer.transport', guardTransport);
            prepared = true;
            await measure('timer.prepare', () => withTimeout(studyGuard!.prepareStudy(new Date(clock.current?.() ?? Date.parse(today.serverNow)).toISOString()), 5000, '공부 준비가 지연되고 있어요. 다시 시도해 주세요.'));
          }
        } else if (!await basicStudyMode.get(identity.profile!.id)) {
          try { await withTimeout(studyGuard.pause(), 3000, '공부 일시정지 확인이 지연되고 있어요.'); } catch { /* Still send the server stop. */ }
        }
      }
      pending.current = action;
      requestingServer = true;
      const result = await withTimeout(action.type === 'start' ? startStudy() : stopStudy(action.id), 20000, '서버의 처리 결과를 확인하지 못했어요. 같은 요청으로 다시 확인해 주세요.');
      requestingServer = false;
      invalidateRecordQueries(studyRoomId);
      if (studyGuard && Platform.OS === 'android') {
        if (action.type === 'start' && !result.data.endedAt && prepared) {
          await measure('timer.bind', () => withTimeout(studyGuard!.bindStudy(result.data.id, identity.profile!.id, studyRoomId, new Date(result.data.startedAt).toISOString()), 5000, '공부 감시 연결을 확인하지 못했어요. 기록을 다시 확인해 주세요.'));
          if (AppState.currentState !== 'active') await withTimeout(studyGuard.pause(), 3000, '공부 일시정지 확인이 지연되고 있어요.');
        } else if (result.data.endedAt) {
          await basicStudyMode.clear(identity.profile!.id);
          await withTimeout(studyGuard.acknowledgeStop(result.data.id), 5000, '휴대폰의 중지 확인이 지연되고 있어요.');
        } else await basicStudyMode.set(identity.profile!.id, result.data.id);
      }
      if (!alive.current || currentScope.current !== scope) return false;
      // Apply the acknowledged session before reloading, even if the next read fails.
      sequence.current++;
      clock.current = createServerClock(result.serverNow);
      setNow(clock.current());
      setToday(previous => {
        if (!previous) return previous;
        const total = displayedSeconds(previous.data.day, previous.data.activeSession, previous.serverNow, Date.parse(result.data.endedAt ?? result.serverNow));
        const stopped = result.data.endedAt !== null;
        return { serverNow: result.serverNow, data: { ...previous.data, activeSession: stopped ? null : result.data,
          day: { ...previous.data.day, closedSeconds: stopped ? total : previous.data.day.closedSeconds,
            runningSeconds: stopped ? 0 : total - previous.data.day.closedSeconds } } };
      });
      pending.current = null; setActionFailed(false);
      succeeded = true;
      return true;
    } catch (failure) {
      if (Platform.OS === 'android' && studyGuard && action.type === 'start' && prepared) {
        try { await withTimeout(studyGuard.pause(), 3000, '공부 준비 정리가 지연되고 있어요.'); } catch { /* Persisted start requests are reconciled on return. */ }
      }
      if (!alive.current || currentScope.current !== scope) return false;
      setError(requestingServer ? toStudyError(failure).message : null);
      setActionFailed(requestingServer);
      return false;
    }
    finally { finish(succeeded ? 'ok' : 'error'); lock.current = false; if (alive.current && currentScope.current === scope) { setBusy(false); void refresh(); if (demand.read().room && isAppActive()) void refreshRoom(); } }
  }, [today, startupReady, identity.loading, identity.error, identity.profile, refresh, refreshRoom, demand, scope, setNow]);
  const value = useMemo(() => ({ today, room, loading, roomLoading, busy, error, roomError, actionFailed, startupReady, startupError, retryStartup, refresh, confirmToday, refreshRoom, toggle }), [today, room, loading, roomLoading, busy, error, roomError, actionFailed, startupReady, startupError, retryStartup, refresh, confirmToday, refreshRoom, toggle]);
  return <StudyClockContext.Provider value={time}><StudyResourceContext.Provider value={demand}><Context.Provider value={value}>{children}</Context.Provider></StudyResourceContext.Provider></StudyClockContext.Provider>;
}
export function useStudy() { const state = useContext(Context); if (!state) throw new Error('StudyProvider required'); return state; }
