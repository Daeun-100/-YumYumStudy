type Persistence = { load(key: string): Promise<unknown | undefined>; save(key: string, value: unknown): Promise<void> };
export function createMemoryCache(limit = 80, persistence?: Persistence) {
  const values = new Map<string, unknown>();
  type Flight = { promise: Promise<unknown>; next: (() => Promise<unknown>) | null };
  const flights = new Map<string, Flight>();
  const listeners = new Map<string, Set<() => void>>();
  const restored = new Set<string>();
  const hydrations = new Map<string, { promise: Promise<void>; discard: boolean }>();
  const notify = (key: string) => listeners.get(key)?.forEach(listener => listener());
  function retain(key: string, value: unknown) {
    values.delete(key); values.set(key, value);
    while (values.size > limit) {
      const oldest = values.keys().next().value!;
      values.delete(oldest); restored.delete(oldest); notify(oldest);
    }
    notify(key);
  }
  return {
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
    async refresh<T>(key: string, loader: () => Promise<T>, changed = false): Promise<T> {
      const running = flights.get(key);
      if (running) {
        if (changed) running.next = loader;
        return running.promise as Promise<T>;
      }
      const entry: Flight = { promise: null as unknown as Promise<unknown>, next: null };
      const flight = Promise.resolve().then(async () => {
        let read: (() => Promise<unknown>) | null = loader;
        let value: unknown;
        while (read) {
          entry.next = null;
          try {
            value = await read();
            if (!entry.next) {
              const hydration = hydrations.get(key);
              if (hydration) hydration.discard = true;
              restored.delete(key);
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
}
export const memoryCache = createMemoryCache();
