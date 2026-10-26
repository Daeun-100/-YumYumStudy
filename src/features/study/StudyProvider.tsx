import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { getRoom, getToday, startStudy, stopStudy, subscribeStudyChanges } from '../../data/study';
import { useIdentity } from '../../components/IdentityProvider';
import { displayedSeconds } from './presentation';
import { createServerClock } from '../../lib/clock';
import { getStudyDate } from '../../lib/study-day';
import { toStudyError, type RoomMember, type Snapshot, type TodayData } from '../../lib/contracts';

type State = { today: Snapshot<TodayData> | null; room: Snapshot<RoomMember[]> | null; now: number; loading: boolean; busy: boolean; error: string | null; roomError: string | null; actionFailed: boolean; refresh(): Promise<void>; toggle(): Promise<boolean> };
const Context = createContext<State | null>(null);
export function StudyProvider({ children }: PropsWithChildren) {
  const identity = useIdentity();
  const [today, setToday] = useState<State['today']>(null);
  const [room, setRoom] = useState<State['room']>(null);
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [actionFailed, setActionFailed] = useState(false);
  const clock = useRef<(() => number) | null>(null);
  const lock = useRef(false);
  const pending = useRef<{ type: 'start' } | { type: 'stop'; id: string } | null>(null);
  const sequence = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const refresh = useCallback(async () => {
    if (!identity.profile || identity.loading) return;
    const request = ++sequence.current;
    setLoading(true);
    const results = await Promise.allSettled([getToday(), getRoom()]);
    if (!alive.current || request !== sequence.current) return;
    if (results[0].status === 'fulfilled') {
      const snapshot = results[0].value;
      clock.current = createServerClock(snapshot.serverNow);
      setNow(clock.current()); setToday(snapshot);
      if (!pending.current) setError(null);
    } else if (!pending.current) setError(toStudyError(results[0].reason).message);
    if (results[1].status === 'fulfilled') {
      setRoom(results[1].value); setRoomError(null);
      if (results[0].status === 'rejected') {
        clock.current = createServerClock(results[1].value.serverNow);
        setNow(clock.current());
      }
    }
    else setRoomError(toStudyError(results[1].reason).message);
    setLoading(false);
  }, [identity.profile, identity.loading]);
  useEffect(() => {
    if (!identity.profile || identity.loading) return;
    const initial = setTimeout(() => { void refresh(); }, 0);
    const active = () => Platform.OS === 'web' ? document.visibilityState === 'visible' : AppState.currentState === 'active';
    const onResume = () => { if (active()) void refresh(); };
    const subscription = AppState.addEventListener('change', onResume);
    if (Platform.OS === 'web') { document.addEventListener('visibilitychange', onResume); window.addEventListener('online', onResume); }
    // Snapshot refreshes also pick up goal edits and recover a missed realtime event.
    const interval = setInterval(onResume, 60000);
    let unsubscribe = () => {};
    try { unsubscribe = subscribeStudyChanges(onResume, state => { if (state === 'connected') onResume(); }); } catch { /* Refresh remains available. */ }
    return () => { clearTimeout(initial); subscription.remove(); unsubscribe(); clearInterval(interval); if (Platform.OS === 'web') { document.removeEventListener('visibilitychange', onResume); window.removeEventListener('online', onResume); } };
  }, [identity.profile, identity.loading, refresh]);
  useEffect(() => {
    let requestedDate = '';
    const tick = setInterval(() => {
      if (!clock.current) return;
      const value = clock.current(); setNow(value);
      const date = getStudyDate(value);
      if (today && today.data.day.studyDate !== date && requestedDate !== date) { requestedDate = date; void refresh(); }
    }, 1000);
    return () => clearInterval(tick);
  }, [today, refresh]);
  const toggle = useCallback(async () => {
    if (lock.current || !today || identity.loading || identity.error) return false;
    lock.current = true; setBusy(true); setError(null);
    const action = pending.current ?? (today.data.activeSession ? { type: 'stop' as const, id: today.data.activeSession.id } : { type: 'start' as const });
    pending.current = action;
    try {
      const result = action.type === 'start' ? await startStudy() : await stopStudy(action.id);
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
      await refresh();
      return true;
    } catch (failure) {
      setError(toStudyError(failure).message + (action.type === 'stop' ? '\n중지를 확인하지 못했습니다. 서버에서 중지가 승인될 때까지의 시간도 기록에 포함됩니다.' : ''));
      setActionFailed(true);
      return false;
    }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }, [today, identity.loading, identity.error, refresh]);
  return <Context.Provider value={{ today, room, now, loading, busy, error, roomError, actionFailed, refresh, toggle }}>{children}</Context.Provider>;
}
export function useStudy() { const state = useContext(Context); if (!state) throw new Error('StudyProvider required'); return state; }
