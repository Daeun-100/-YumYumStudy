type Persistence = { load(key: string): Promise<unknown | undefined>; save(key: string, value: unknown): Promise<void> };
export function createMemoryCache(limit = 80, persistence?: Persistence) {
  const values = new Map<string, unknown>();
  type Read = { loader: () => Promise<unknown>; version: string };
  type Flight = { promise: Promise<unknown>; next: Read | null; version: string };
  const freshness = new Map<string, { at: number; version: string }>();
  const revisions = new Map<string, number>();
  const flights = new Map<string, Flight>();
  const listeners = new Map<string, Set<() => void>>();
  const restored = new Set<string>();
  const hydrations = new Map<string, { promise: Promise<void>; discard: boolean }>();
  const notify = (key: string) => listeners.get(key)?.forEach(listener => listener());
  function retain(key: string, value: unknown) {
    values.delete(key); values.set(key, value);
    while (values.size > limit) {
      const oldest = values.keys().next().value!;
      values.delete(oldest); restored.delete(oldest); freshness.delete(oldest); revisions.delete(oldest); notify(oldest);
    }
    notify(key);
  }
  const cache = {
    revision(key: string) { return revisions.get(key) ?? 0; },
    invalidate(matches: (key: string) => boolean) {
      for (const key of new Set([...values.keys(), ...flights.keys(), ...hydrations.keys()])) {
        if (!matches(key)) continue;
        freshness.delete(key);
        revisions.set(key, (revisions.get(key) ?? 0) + 1);
        notify(key);
      }
    },
    load<T>(key: string, loader: () => Promise<T>, maxAge = 30000, version = '', force = false): Promise<T> {
      const requested = JSON.stringify([revisions.get(key) ?? 0, version]);
      const fresh = freshness.get(key);
      if (!force && values.has(key) && fresh?.version === requested && Date.now() - fresh.at < maxAge) return Promise.resolve(values.get(key) as T);
      const running = flights.get(key);
      return cache.refresh(key, loader, force || !!running && running.version !== requested, requested);
    },
    read<T>(key: string): T | undefined { return values.get(key) as T | undefined; },
    isRestored(key: string): boolean { return restored.has(key); },
    hydrate(key: string): Promise<void> {
      if (!persistence || values.has(key)) return Promise.resolve();
      const running = hydrations.get(key);
      if (running) return running.promise;
      const entry = { promise: null as unknown as Promise<void>, discard: false };
      const hydration = persistence.load(key).then(value => {
        // A disk read finishing after the network must never replace live data.
        if (value !== undefined && !entry.discard && !values.has(key)) { restored.add(key); retain(key, value); }
      }).catch(() => {}).finally(() => { hydrations.delete(key); });
      entry.promise = hydration;
      hydrations.set(key, entry);
      return hydration;
    },
    subscribe(key: string, listener: () => void) {
      const group = listeners.get(key) ?? new Set<() => void>();
      group.add(listener); listeners.set(key, group);
      return () => { group.delete(listener); if (!group.size) listeners.delete(key); };
    },
    async refresh<T>(key: string, loader: () => Promise<T>, changed = false, version = ''): Promise<T> {
      const running = flights.get(key);
      if (running) {
        if (changed) running.next = { loader, version };
        return running.promise as Promise<T>;
      }
      const entry: Flight = { promise: null as unknown as Promise<unknown>, next: null, version };
      const flight = Promise.resolve().then(async () => {
        let read: Read | null = { loader, version };
        let value: unknown;
        while (read) {
          entry.next = null;
          entry.version = read.version;
          const revision = revisions.get(key) ?? 0;
          try {
            value = await read.loader();
            if (!entry.next) {
              const hydration = hydrations.get(key);
              if (hydration) hydration.discard = true;
              restored.delete(key);
              if ((revisions.get(key) ?? 0) === revision) freshness.set(key, { at: Date.now(), version: read.version });
              retain(key, value);
              void persistence?.save(key, value).catch(() => {});
            }
          } catch (error) { if (!entry.next) throw error; }
          read = entry.next;
        }
        return value as T;
      }).finally(() => { flights.delete(key); });
      entry.promise = flight;
      flights.set(key, entry);
      return flight;
    },
  };
  return cache;
}
export const memoryCache = createMemoryCache();
