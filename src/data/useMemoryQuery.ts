import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { memoryCache } from './query-cache';
import { toStudyError } from '../lib/contracts';
import { studyRoomId } from '../lib/room';
import { useIdentity } from '../components/IdentityProvider';
import { isAppActive, useRefreshOnResume } from '../hooks/useRefreshOnResume';

type Options = { staleTime?: number; version?: string };
/** Scope every read to the authenticated viewer and room, including friend data. */
export function useMemoryQuery<T>(parts: readonly unknown[], loader: () => Promise<T>, { staleTime = 30000, version = '' }: Options = {}) {
  const identity = useIdentity();
  const key = JSON.stringify([studyRoomId, identity.uid, ...parts]);
  const enabled = !!identity.uid && !!identity.profile && !identity.loading;
  const latestLoader = useRef(loader);
  useEffect(() => { latestLoader.current = loader; }, [loader]);
  const focused = useRef(false);
  const generation = useRef(0);
  const subscribe = useCallback((listener: () => void) => memoryCache.subscribe(key, listener), [key]);
  const read = useCallback(() => enabled ? memoryCache.read<T>(key) : undefined, [key, enabled]);
  const data = useSyncExternalStore(subscribe, read, read);
  const readRestored = useCallback(() => enabled && memoryCache.isRestored(key), [enabled, key]);
  const cached = useSyncExternalStore(subscribe, readRestored, readRestored);
  const readRevision = useCallback(() => memoryCache.revision(key), [key]);
  const revision = useSyncExternalStore(subscribe, readRevision, readRevision);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const run = useCallback((force = false) => {
    if (!enabled || !focused.current || !isAppActive()) return;
    const requestGeneration = generation.current;
    const load = latestLoader.current;
    void memoryCache.hydrate(key);
    void memoryCache.load(key, load, staleTime, version, force)
      .then(() => { if (requestGeneration === generation.current) setFailure(null); })
      .catch(error => { if (requestGeneration === generation.current) setFailure({ key, message: toStudyError(error).message }); });
  }, [enabled, key, staleTime, version]);
  useFocusEffect(useCallback(() => {
    void revision;
    focused.current = true;
    generation.current++;
    run();
    // Recover remote edits while the screen stays open; hidden screens do no polling.
    const timer = setInterval(() => { run(); }, staleTime);
    return () => { focused.current = false; generation.current++; clearInterval(timer); };
  }, [run, revision, staleTime]));
  useRefreshOnResume(run, enabled);
  const error = failure?.key === key ? failure.message : '';
  return { data, error, cached, loading: data === undefined && !error, retry: () => { run(true); } };
}
