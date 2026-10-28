import { studyRoomId } from '../../lib/room';
import { invalidateRecordQueries } from '../../data/query-cache';
import { useStudyNow } from '../study/study-clock';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { isAppActive, useRefreshOnResume } from '../../hooks/useRefreshOnResume';
import { useIdentity } from '../../components/IdentityProvider';
import { useStudy } from '../study/StudyProvider';
import { getLeaveStatus, resumePendingLeave, scheduleLeave, cancelLeave } from '../../data/leave';
import { toStudyError, type LeaveStatus, type Snapshot } from '../../lib/contracts';
import { leaveRefreshKey } from '../../lib/leave-refresh';

type State = { snapshot: Snapshot<LeaveStatus> | null; error: string | null; busy: boolean; actionFailed: boolean; refresh(): Promise<void>; schedule(date: string, grantId?: string | null): Promise<boolean>; cancel(grantId: string, date: string): Promise<boolean> };
const Context = createContext<State | null>(null);
export function LeaveProvider({ children }: PropsWithChildren) {
  const identity = useIdentity();
  const study = useStudy();
  const studyNow = useStudyNow();
  const uid = !identity.loading && identity.profile ? identity.uid : null;
  const [state, setState] = useState<{ uid: string | null; snapshot: State['snapshot']; error: string | null }>({ uid: null, snapshot: null, error: null });
  const [busy, setBusy] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const mutationLock = useRef(false);
  const runner = useRef<(() => Promise<void>) | null>(null);
  const retryNeeded = useRef(false);
  const refresh = useCallback(async () => { await runner.current?.(); }, []);
  useRefreshOnResume(refresh, !!uid);
  useEffect(() => {
    retryNeeded.current = false;
    if (!uid) { runner.current = null; return; }
    let disposed = false;
    let again = false;
    let flight: Promise<void> | null = null;
    const run = (): Promise<void> => {
      if (mutationLock.current) return Promise.resolve();
      if (flight) { again = true; return flight; }
      flight = (async () => {
        do {
          again = false;
          try {
            let pendingError: string | null = null;
            try { await resumePendingLeave(); }
            catch (failure) {
              const error = toStudyError(failure);
              if (error.code !== 'VALIDATION') throw failure;
              pendingError = error.message;
            }
            const snapshot = await getLeaveStatus();
            if (!disposed) { retryNeeded.current = false; setActionFailed(false); setState(previous => previous.uid === uid && previous.snapshot && previous.snapshot.data.revision > snapshot.data.revision ? previous : { uid, snapshot, error: pendingError }); }
          } catch (failure) {
            if (!disposed) { retryNeeded.current = true; setActionFailed(true); setState(s => ({ uid, snapshot: s.uid === uid ? s.snapshot : null, error: toStudyError(failure).message })); }
          }
        } while (again && !disposed);
      })().finally(() => { flight = null; });
      return flight;
    };
    runner.current = run;
    const initial = setTimeout(() => { if (isAppActive()) void run(); }, 0);
    return () => {
      disposed = true; runner.current = null; clearTimeout(initial);
    };
  }, [uid]);
  // A successful study read is evidence that connectivity recovered, including on native.
  useEffect(() => {
    if (!uid || !study.today || !retryNeeded.current) return;
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [uid, study.today, refresh]);
  const snapshot = state.uid === uid ? state.snapshot : null;
  const trigger = leaveRefreshKey(study.today, studyNow, snapshot);
  const previous = useRef('');
  useEffect(() => {
    if (!uid || !trigger) return;
    const key = `${uid}:${trigger}`;
    if (previous.current === key) return;
    // Trigger only on changes to day, achievement or a due state boundary.
    const timer = setTimeout(() => { previous.current = key; void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [uid, trigger, refresh]);
  const refreshStudy = study.refresh;
  const mutate = useCallback(async function mutate(action: 'schedule' | 'cancel', date: string, grantId: string | null): Promise<boolean> {
    if (mutationLock.current || actionFailed || !snapshot || !uid) return false;
    mutationLock.current = true; setBusy(true);
    try {
      const result = action === 'schedule' ? await scheduleLeave(date, snapshot.data.revision, grantId) : await cancelLeave(grantId!, date, snapshot.data.revision);
      setState({ uid, snapshot: result, error: null });
      invalidateRecordQueries(studyRoomId); setActionFailed(false);
      void refreshStudy();
      return true;
    } catch (failure) {
      const error = toStudyError(failure);
      setActionFailed(error.code !== 'VALIDATION');
      retryNeeded.current = true;
      setState(previous => ({ ...previous, error: error.message }));
      return false;
    } finally { mutationLock.current = false; setBusy(false); if (retryNeeded.current) void refresh(); }
  }, [actionFailed, snapshot, uid, refreshStudy, refresh]);
  const value = useMemo<State>(() => ({ snapshot, error: state.uid === uid ? state.error : null, busy, actionFailed, refresh,
    schedule: (date, grantId = null) => mutate('schedule', date, grantId), cancel: (grantId, date) => mutate('cancel', date, grantId) }), [snapshot, state.uid, state.error, uid, busy, actionFailed, refresh, mutate]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useLeave() { const value = useContext(Context); if (!value) throw new Error('LeaveProvider required'); return value; }
