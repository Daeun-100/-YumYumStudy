import type { ReactNode } from 'react';

export type ToastDismissReason = 'timeout' | 'manual' | 'blocked' | 'background' | 'scope' | 'unmount' | 'rejected';
export type ToastRenderContext = { dismiss(): void; reducedMotion: boolean; screenReader: boolean };
export type ToastOptions = {
  id?: string;
  dedupeKey?: string;
  title?: string;
  message?: string;
  showIcon?: boolean;
  tone?: 'info' | 'success' | 'reward';
  /** null is reserved for custom content that owns a multi-phase lifetime. */
  durationMs?: number | null;
  render?(context: ToastRenderContext): ReactNode;
  onShow?(): void;
  onDismiss?(reason: ToastDismissReason): void;
};
export const TOAST_EXIT_MS = 200;
export type ToastEntry = ToastOptions & { id: string; presented: boolean; closing?: boolean };
type Environment = { enabled: boolean; active: boolean; blocked: boolean; screenReader: boolean; reducedMotion?: boolean };
type Clock = { setTimer(run: () => void, ms: number): ReturnType<typeof setTimeout>; clearTimer(id: ReturnType<typeof setTimeout>): void };

/** Bounded, provider-local queue. No notification history or user content is persisted. */
export function createToastStore(clock: Clock = { setTimer: (run, ms) => setTimeout(run, ms), clearTimer: id => clearTimeout(id) }) {
  let scope = '', sequence = 0, timer: ReturnType<typeof setTimeout> | undefined;
  let environment: Environment = { enabled: false, active: false, blocked: false, screenReader: false };
  let active: ToastEntry | null = null, queue: ToastEntry[] = [];
  let snapshot = { scope, active, pendingCount: 0 } as { scope: string; active: ToastEntry | null; pendingCount: number };
  const listeners = new Set<() => void>(), completed = new Set<string>();
  const emit = () => { snapshot = { scope, active, pendingCount: queue.length }; listeners.forEach(listener => listener()); };
  const stop = () => { if (timer !== undefined) clock.clearTimer(timer); timer = undefined; };
  const notify = (run: (() => void) | undefined) => { try { run?.(); } catch { /* A consumer callback cannot break the shared host. */ } };
  const remember = (entry: ToastEntry) => {
    if (!entry.presented || !entry.dedupeKey) return;
    completed.add(entry.dedupeKey);
    if (completed.size > 100) completed.delete(completed.values().next().value!);
  };
  const pump = () => {
    if (!active && environment.enabled && environment.active && !environment.blocked && queue.length) { active = queue.shift()!; emit(); }
  };
  const finish = (id: string, reason: ToastDismissReason) => {
    if (active?.id === id) {
      const old = active; active = null; stop(); remember(old); emit();
      notify(() => old.onDismiss?.(reason)); pump();
    } else {
      const old = queue.find(entry => entry.id === id);
      if (!old) return;
      queue = queue.filter(entry => entry.id !== id); emit(); notify(() => old.onDismiss?.(reason));
    }
  };
  const dismiss = (id: string, reason: ToastDismissReason = 'manual') => {
    if (active?.id === id && !active.render && active.presented && !environment.reducedMotion && (reason === 'manual' || reason === 'timeout')) {
      if (active.closing) return;
      active = { ...active, closing: true }; stop();
      timer = clock.setTimer(() => finish(id, reason), TOAST_EXIT_MS); emit();
    } else finish(id, reason);
  };
  const arm = () => {
    if (active?.closing) return;
    stop();
    if (!active?.presented || active.durationMs === null) return;
    const id = active.id, requested = active.durationMs ?? 4000;
    const duration = Number.isFinite(requested) ? Math.max(500, Math.min(60000, requested)) : 4000;
    timer = clock.setTimer(() => dismiss(id, 'timeout'), environment.screenReader ? Math.max(10000, duration) : duration);
  };
  const clear = (reason: ToastDismissReason) => {
    const entries = [...(active ? [active] : []), ...queue];
    entries.forEach(remember); active = null; queue = []; stop(); emit();
    entries.forEach(entry => notify(() => entry.onDismiss?.(reason)));
  };
  return {
    read: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setScope(next: string) {
      if (next === scope) return;
      // Change the token first so old async callbacks cannot publish into the new owner.
      scope = next; clear('scope'); completed.clear(); emit();
    },
    setEnvironment(next: Environment) {
      const readerChanged = next.screenReader !== environment.screenReader;
      environment = next;
      if (!next.enabled || !next.active) { clear('background'); return; }
      if (next.blocked && active) dismiss(active.id, 'blocked');
      if (readerChanged) arm();
      pump();
    },
    show(options: ToastOptions, expectedScope: string): string | null {
      if (scope !== expectedScope || !environment.enabled || !environment.active || (!options.render && !options.title?.trim() && !options.message?.trim())) return null;
      const existing = [active, ...queue].find(entry => entry && ((!!options.id && entry.id === options.id) || (!!options.dedupeKey && entry.dedupeKey === options.dedupeKey)));
      if (existing) return existing.id;
      if (options.dedupeKey && completed.has(options.dedupeKey)) return null;
      if (queue.length >= 5) return null;
      const id = options.id ?? `toast-${++sequence}`;
      queue.push({ ...options, id, presented: false }); emit(); pump(); return id;
    },
    update(id: string, patch: Partial<ToastOptions>, expectedScope: string): boolean {
      if (scope !== expectedScope) return false;
      if (active?.id === id) {
        if (active.closing) return false;
        active = { ...active, ...patch, id, presented: active.presented };
        if ('durationMs' in patch) arm(); emit(); return true;
      }
      const index = queue.findIndex(entry => entry.id === id);
      if (index < 0) return false;
      queue[index] = { ...queue[index], ...patch, id, presented: false }; emit(); return true;
    },
    dismiss(id: string, expectedScope: string, reason: ToastDismissReason = 'manual') { if (scope === expectedScope) dismiss(id, reason); },
    didPresent(id: string, expectedScope: string) {
      if (scope !== expectedScope || !active || active.id !== id || active.presented || !environment.enabled || !environment.active || environment.blocked) return;
      const presented = { ...active, presented: true }; active = presented; arm(); emit(); notify(presented.onShow);
    },
    clear(expectedScope: string) { if (scope === expectedScope) clear('manual'); },
    dispose() { environment = { ...environment, enabled: false }; clear('unmount'); listeners.clear(); },
  };
}
