import type { GuardStatus } from './native';

type Guard = { status(): Promise<GuardStatus>; select(packages: string[]): Promise<void> };
type Callbacks = {
  onPending(packages: string[]): void;
  onStatus(status: GuardStatus): void;
  onError(error: unknown): void;
};

// Each write contains the whole allowlist. Read it at execution time so queued
// changes to different apps never overwrite one another with an old snapshot.
export function createAllowedAppsSelectionQueue(guard: Guard, callbacks: Callbacks) {
  const pending = new Set<string>();
  let tail = Promise.resolve();
  let revision = 0;
  return {
    get revision() { return revision; },
    get pending() { return pending.size > 0; },
    select(packageName: string, enabled: boolean) {
      if (pending.has(packageName)) return tail;
      pending.add(packageName);
      revision += 1;
      callbacks.onPending([...pending]);
      tail = tail.then(async () => {
        try {
          const status = await guard.status();
          if (status.running) throw new Error('일시정지 후 허용앱을 변경해 주세요');
          const allowed = new Set(status.allowed);
          if (enabled) allowed.add(packageName); else allowed.delete(packageName);
          await guard.select([...allowed]);
          callbacks.onStatus(await guard.status());
        } catch (error) {
          callbacks.onError(error);
          try { callbacks.onStatus(await guard.status()); } catch { /* Keep the last confirmed state. */ }
        } finally {
          pending.delete(packageName);
          revision += 1;
          callbacks.onPending([...pending]);
        }
      });
      return tail;
    },
  };
}
