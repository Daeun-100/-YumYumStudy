export function createMemoryCache(limit = 80) {
  const values = new Map<string, unknown>();
  const flights = new Map<string, Promise<unknown>>();
  const listeners = new Map<string, Set<() => void>>();
  return {
    read<T>(key: string): T | undefined { return values.get(key) as T | undefined; },
    subscribe(key: string, listener: () => void) {
      const group = listeners.get(key) ?? new Set<() => void>();
      group.add(listener); listeners.set(key, group);
      return () => { group.delete(listener); if (!group.size) listeners.delete(key); };
    },
    async refresh<T>(key: string, loader: () => Promise<T>): Promise<T> {
      const running = flights.get(key);
      if (running) return running as Promise<T>;
      const flight = Promise.resolve().then(loader).then(value => {
        values.delete(key); values.set(key, value);
        while (values.size > limit) {
          const oldest = values.keys().next().value!;
          values.delete(oldest);
          listeners.get(oldest)?.forEach(listener => listener());
        }
        listeners.get(key)?.forEach(listener => listener());
        return value;
      }).finally(() => { flights.delete(key); });
      flights.set(key, flight);
      return flight;
    },
  };
}
export const memoryCache = createMemoryCache();
