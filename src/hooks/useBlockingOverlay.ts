import { useEffect, useState, useSyncExternalStore } from 'react';

const overlays = new Set<object>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const read = () => overlays.size > 0;
export function useBlockingOverlay(visible: boolean) {
  const [token] = useState(() => ({}));
  useEffect(() => {
    if (!visible) return;
    overlays.add(token); emit();
    return () => { overlays.delete(token); emit(); };
  }, [token, visible]);
}
export function useOverlaysBlocked() { return useSyncExternalStore(subscribe, read, () => false); }
