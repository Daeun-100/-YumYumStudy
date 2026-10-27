export type LayoutSize = { width: number; height: number };
type Storage = { getItem(key: string): string | null | Promise<string | null>; setItem(key: string, value: string): void | Promise<void> };
const storageKey = 'yumyumstudy.layout.v1';
const valid = (value: unknown): value is LayoutSize => {
  const size = value as LayoutSize | null;
  return !!size && Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0 && size.width < 20000 && size.height < 20000;
};
export function createLayoutCache(storage: Storage) {
  const entries = new Map<string, LayoutSize>();
  const listeners = new Set<() => void>();
  let hydration: Promise<void> | undefined;
  let writes = Promise.resolve();
  return {
    read(key: string) { return entries.get(key) ?? null; },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    hydrate() {
      return hydration ??= Promise.resolve().then(() => storage.getItem(storageKey)).then(raw => {
        if (!raw) return;
        const restored: unknown = JSON.parse(raw);
        if (!Array.isArray(restored)) return;
        for (const item of restored.slice(-24)) {
          if (Array.isArray(item) && typeof item[0] === 'string' && valid(item[1]) && !entries.has(item[0])) entries.set(item[0], item[1]);
        }
        listeners.forEach(listener => listener());
      }).catch(() => { /* A missing or damaged layout cache never blocks the app. */ });
    },
    measure(key: string, size: LayoutSize) {
      if (!valid(size)) return;
      const previous = entries.get(key);
      if (previous?.width === size.width && previous.height === size.height) return;
      entries.delete(key); entries.set(key, { width: size.width, height: size.height });
      while (entries.size > 24) entries.delete(entries.keys().next().value!);
      listeners.forEach(listener => listener());
      const serialized = JSON.stringify([...entries]);
      writes = writes.then(() => storage.setItem(storageKey, serialized)).catch(() => {});
    },
    flush() { return writes; },
  };
}
