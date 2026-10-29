export type OtaSnapshot = { pending: boolean; phase: 'idle' | 'checking' | 'downloading' | 'applying' };
export type ApplyResult = 'applied' | 'blocked' | 'failed' | 'not-ready';
type Dependencies = {
  active(): boolean;
  safe(): boolean;
  check(): Promise<{ isAvailable: boolean; isRollBackToEmbedded: boolean }>;
  fetch(): Promise<{ isNew: boolean; isRollBackToEmbedded: boolean }>;
  prepare(): Promise<boolean>;
  begin(): boolean;
  reload(): Promise<void>;
  cancel(): void;
  changed(snapshot: OtaSnapshot): void;
  now(): number;
};

export function createOtaController(deps: Dependencies) {
  let pending = false, disposed = false, committed = false;
  let phase: OtaSnapshot['phase'] = 'idle';
  let nextCheck = 0;
  const emit = () => { if (!disposed) deps.changed({ pending, phase }); };
  const downloaded = () => { if (!pending && !disposed) { pending = true; emit(); } };
  return {
    dispose() { disposed = true; },
    downloaded,
    async check(force = false): Promise<'ready' | 'latest' | 'failed' | 'skipped'> {
      if (disposed || committed || phase !== 'idle' || !deps.active()) return 'skipped';
      if (pending) return 'ready';
      if (!force && deps.now() < nextCheck) return 'skipped';
      nextCheck = deps.now() + 60_000;
      phase = 'checking'; emit();
      try {
        const update = await deps.check();
        if (disposed) return 'skipped';
        if (!update.isAvailable && !update.isRollBackToEmbedded) return pending ? 'ready' : 'latest';
        phase = 'downloading'; emit();
        const result = await deps.fetch();
        if (disposed) return 'skipped';
        if (result.isNew || result.isRollBackToEmbedded) downloaded();
        return pending ? 'ready' : 'latest';
      } catch { return 'failed'; }
      finally { phase = 'idle'; emit(); }
    },
    // Only a user action calls this method. Downloads/resume never trigger it.
    async apply(): Promise<ApplyResult> {
      if (disposed || committed || !pending || phase !== 'idle') return 'not-ready';
      if (!deps.active() || !deps.safe()) return 'blocked';
      phase = 'applying'; emit();
      try {
        if (!await deps.prepare() || disposed || !deps.active() || !deps.safe() || !deps.begin()) return 'blocked';
        committed = true;
        await deps.reload();
        // Keep the gate closed and the button busy until the JS runtime restarts.
        return 'applied';
      } catch {
        committed = false;
        deps.cancel();
        return 'failed';
      } finally { if (!committed) { phase = 'idle'; emit(); } }
    },
    isPending() { return pending; },
  };
}
