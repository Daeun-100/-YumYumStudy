/** One resource owns one completion-based timeout. No cross-resource scheduler. */
export function createResourceRefresh({ refresh, schedule = setTimeout, cancel = clearTimeout, random = Math.random }: {
  refresh(changed: boolean): Promise<void>;
  schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
  random?: () => number;
}) {
  let enabled = false, connected = false, disposed = false, dirty = true, fresh = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let flight: Promise<void> | null = null;
  function clear() { if (timer !== undefined) cancel(timer); timer = undefined; }
  function delay() {
    if (failures) return Math.min(60000, 5000 * 2 ** Math.min(failures - 1, 4) * (.9 + random() * .2));
    return connected ? 60000 : 15000;
  }
  function arm() {
    clear();
    if (enabled && !disposed && !flight) timer = schedule(() => { timer = undefined; void request(false); }, delay());
  }
  function request(changed = true): Promise<void> {
    if (disposed) return Promise.resolve();
    if (changed) dirty = true;
    if (!enabled) return Promise.resolve();
    if (flight) return flight;
    // Repeated realtime messages must not turn an outage into a tight retry loop.
    if (failures && timer !== undefined) return Promise.resolve();
    clear();
    const work = Promise.resolve().then(async () => {
      if (!enabled || disposed) return;
      do {
        const changedDuringOtherRead = dirty;
        dirty = false;
        try { await refresh(changedDuringOtherRead); failures = 0; fresh = true; }
        catch { failures++; break; }
      } while (dirty && enabled && !disposed);
    }).finally(() => { if (flight === work) { flight = null; if (dirty && enabled && !disposed && !failures) void request(false); else arm(); } });
    flight = work;
    return work;
  }
  return {
    request,
    setEnabled(value: boolean) {
      if (disposed || enabled === value) return;
      enabled = value;
      if (!value) { dirty = true; clear(); return; }
      if (dirty || !fresh) void request(false); else arm();
    },
    setConnected(value: boolean) {
      if (disposed || connected === value) return;
      connected = value;
      if (value && enabled) { clear(); void request(true); } else arm();
    },
    /** An explicit user/startup read succeeded outside this observation loop. */
    markFresh() { if (!disposed) { failures = 0; fresh = true; if (!flight) dirty = false; arm(); } },
    dispose() { disposed = true; enabled = false; clear(); },
  };
}
