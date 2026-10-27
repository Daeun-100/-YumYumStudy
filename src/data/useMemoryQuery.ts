import { useFocusEffect } from 'expo-router';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { memoryCache } from './query-cache';
import { toStudyError } from '../lib/contracts';
import { studyRoomId } from '../lib/room';
import { useIdentity } from '../components/IdentityProvider';

/** Scope every read to the authenticated viewer and room, including friend data. */
export function useMemoryQuery<T>(parts: readonly unknown[], loader: () => Promise<T>) {
  const identity = useIdentity();
  const key = JSON.stringify([studyRoomId, identity.uid, ...parts]);
  const enabled = !!identity.uid && !!identity.profile && !identity.loading;
  const subscribe = useCallback((listener: () => void) => memoryCache.subscribe(key, listener), [key]);
  const read = useCallback(() => enabled ? memoryCache.read<T>(key) : undefined, [key, enabled]);
  const data = useSyncExternalStore(subscribe, read, read);
  const readRestored = useCallback(() => enabled && memoryCache.isRestored(key), [enabled, key]);
  const cached = useSyncExternalStore(subscribe, readRestored, readRestored);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    void attempt;
    if (!enabled) return;
    let active = true;
    void memoryCache.hydrate(key);
    void memoryCache.refresh(key, loader, true).then(() => { if (active) setFailure(null); })
      .catch(error => { if (active) setFailure({ key, message: toStudyError(error).message }); });
    return () => { active = false; };
  }, [key, loader, enabled, attempt]));
  const error = failure?.key === key ? failure.message : '';
  return { data, error, cached, loading: data === undefined && !error, retry: () => setAttempt(value => value + 1) };
}
