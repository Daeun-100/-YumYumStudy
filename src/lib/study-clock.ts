/** A provider-local clock: ticks notify time subscribers without updating study data. */
export function createStudyClock() {
  let now = 0;
  const listeners = new Set<() => void>();
  return {
    read: () => now,
    set(value: number) {
      if (value === now) return;
      now = value;
      listeners.forEach(listener => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
