import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import type { createStudyClock } from '../../lib/study-clock';

export const StudyClockContext = createContext<ReturnType<typeof createStudyClock> | null>(null);
const inactive = () => () => {};

/** Opt into ticks only where time is displayed. Historical records need no ticks. */
export function useStudyNow(enabled = true, resolution = 1) {
  const clock = useContext(StudyClockContext);
  if (!clock) throw new Error('StudyProvider required');
  const read = useCallback(() => enabled ? Math.floor(clock.read() / resolution) * resolution : 0, [clock, enabled, resolution]);
  return useSyncExternalStore(enabled ? clock.subscribe : inactive, read, read);
}
