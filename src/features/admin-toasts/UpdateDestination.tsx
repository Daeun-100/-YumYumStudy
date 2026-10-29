import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { router } from 'expo-router';
type Attempt = { id: number; campaignId: string };
type Destination = { attempt: Attempt | null; open(campaignId: string): Promise<void>; ready(id: number): void; cancel(campaignId: string): void };
const Context = createContext<Destination>({ attempt: null, open: async () => { throw Error('Destination unavailable'); }, ready: () => {}, cancel: () => {} });
export function useUpdateDestination() { return useContext(Context); }
export function UpdateDestinationProvider({ children }: PropsWithChildren) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const sequence = useRef(0);
  const pending = useRef<{ attempt: Attempt; timer: ReturnType<typeof setTimeout>; resolve(): void; reject(): void } | null>(null);
  const finish = useCallback((id: number, success: boolean) => {
    const p = pending.current; if (!p || p.attempt.id !== id) return;
    pending.current = null; clearTimeout(p.timer); setAttempt(null);
    if (success) p.resolve(); else p.reject();
  }, []);
  useEffect(() => () => { const p = pending.current; if (p) { clearTimeout(p.timer); p.reject(); pending.current = null; } }, []);
  const open = useCallback((campaignId: string) => new Promise<void>((resolve, reject) => {
    if (pending.current) finish(pending.current.attempt.id, false);
    const next = { id: ++sequence.current, campaignId };
    pending.current = { attempt: next, resolve, reject: () => reject(Error('Destination not visible')), timer: setTimeout(() => finish(next.id, false), 5000) };
    setAttempt(next);
    try { router.navigate('/profile'); } catch { finish(next.id, false); }
  }), [finish]);
  const ready = useCallback((id: number) => finish(id, true), [finish]);
  const cancel = useCallback((campaignId: string) => { if (pending.current?.attempt.campaignId === campaignId) finish(pending.current.attempt.id, false); }, [finish]);
  const value = useMemo(() => ({ attempt, open, ready, cancel }), [attempt, open, ready, cancel]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
