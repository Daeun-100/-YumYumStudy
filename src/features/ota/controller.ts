type Dependencies = {
  active(): boolean;
  safe(): boolean;
  check(): Promise<{ isAvailable: boolean; isRollBackToEmbedded: boolean }>;
  fetch(): Promise<{ isNew: boolean; isRollBackToEmbedded: boolean }>;
  prepare(): Promise<boolean>;
  begin(): boolean;
  reload(): Promise<void>;
  cancel(): void;
  changed(): void;
  now(): number;
};

export function createOtaController(deps: Dependencies) {
  let pending = false, checking = false, applying = false, disposed = false;
  let nextCheck = 0, nextApply = 0;
  return {
    dispose() { disposed = true; },
    downloaded() { if (!pending) { pending = true; deps.changed(); } },
    async check() {
      if (disposed || pending || checking || !deps.active() || deps.now() < nextCheck) return;
      checking = true;
      nextCheck = deps.now() + 60_000;
      try {
        const update = await deps.check();
        if (disposed || (!update.isAvailable && !update.isRollBackToEmbedded)) return;
        const result = await deps.fetch();
        if (!disposed && (result.isNew || result.isRollBackToEmbedded)) this.downloaded();
      } catch { /* Offline/failed downloads keep the current app usable. */ }
      finally { checking = false; }
    },
    async apply() {
      if (disposed || !pending || applying || !deps.active() || !deps.safe() || deps.now() < nextApply) return;
      applying = true;
      // Includes failed native/server reconciliation; never retry it every second.
      nextApply = deps.now() + 60_000;
      try {
        if (!await deps.prepare() || disposed || !deps.active() || !deps.safe() || !deps.begin()) return;
        await deps.reload();
        // Success keeps the synchronous gate closed until the JS runtime restarts.
      } catch { deps.cancel(); }
      finally { applying = false; }
    },
    isPending() { return pending; },
  };
}
