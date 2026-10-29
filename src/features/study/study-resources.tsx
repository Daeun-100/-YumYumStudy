import { createContext, useCallback, useContext } from 'react';
import { useFocusEffect } from 'expo-router';
import type { createStudyResourceDemand, StudyResource } from '../../lib/study-resource-demand';

export const StudyResourceContext = createContext<ReturnType<typeof createStudyResourceDemand> | null>(null);

export function useStudyResources(resources: readonly StudyResource[]) {
  const demand = useContext(StudyResourceContext);
  if (!demand) throw new Error('StudyProvider required');
  const today = resources.includes('today'), room = resources.includes('room');
  useFocusEffect(useCallback(() => demand.acquire([
    ...(today ? ['today' as const] : []), ...(room ? ['room' as const] : []),
  ]), [demand, today, room]));
}
