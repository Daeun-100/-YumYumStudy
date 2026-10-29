import { useCallback, useEffect, useRef } from 'react';
import { createResourceRefresh } from '../lib/resource-refresh';
import { useAppActive } from './useAppActive';
import { isAppActive, useRefreshOnResume } from './useRefreshOnResume';

type Entry = { scope: string; loop: ReturnType<typeof createResourceRefresh> };
/** Scope changes create a new loop; background/blur cancel only observation. */
export function useResourceRefresh({ scope, enabled, connected, refresh }: { scope: string; enabled: boolean; connected: boolean; refresh(changed: boolean): Promise<void> }) {
  const active = useAppActive();
  const latest = useRef(refresh);
  const current = useRef<Entry | null>(null);
  useEffect(() => { latest.current = refresh; }, [refresh]);
  useEffect(() => {
    const entry = { scope, loop: createResourceRefresh({ refresh: changed => latest.current(changed) }) };
    current.current = entry;
    return () => { entry.loop.dispose(); if (current.current === entry) current.current = null; };
  }, [scope]);
  useEffect(() => { current.current?.loop.setConnected(connected); }, [scope, connected]);
  useEffect(() => {
    const loop = current.current?.loop;
    loop?.setEnabled(enabled && active);
    return () => loop?.setEnabled(false);
  }, [scope, enabled, active]);
  const request = useCallback((changed = true) => isAppActive() && current.current?.scope === scope ? current.current.loop.request(changed) : Promise.resolve(), [scope]);
  const resume = useCallback(() => { void request(false); }, [request]);
  useRefreshOnResume(resume, enabled);
  const markFresh = useCallback(() => { if (current.current?.scope === scope) current.current.loop.markFresh(); }, [scope]);
  return { request, markFresh };
}
