type EventTarget = {
  addEventListener(event: string, callback: () => void): void;
  removeEventListener(event: string, callback: () => void): void;
};
type Environment = {
  kind: 'web';
  document(): (EventTarget & { visibilityState: string }) | undefined;
  window(): EventTarget | undefined;
} | {
  kind: 'native';
  currentState(): string | null | undefined;
  subscribe(callback: () => void): () => void;
};

/** Shared contract: visible foreground, state notifications, and active-only recovery. */
export function createAppActivity(environment: Environment) {
  const isActive = () => environment.kind === 'web'
    ? environment.document()?.visibilityState === 'visible'
    : environment.currentState() === 'active';
  const subscribe = (callback: () => void) => {
    if (environment.kind === 'native') return environment.subscribe(callback);
    const target = environment.document();
    target?.addEventListener('visibilitychange', callback);
    return () => target?.removeEventListener('visibilitychange', callback);
  };
  return {
    isActive, subscribe,
    onResume(callback: () => void) {
      const refresh = () => { if (isActive()) callback(); };
      const stop = subscribe(refresh);
      const target = environment.kind === 'web' ? environment.window() : undefined;
      target?.addEventListener('online', refresh);
      return () => { stop(); target?.removeEventListener('online', refresh); };
    },
  };
}
