export type StudyResource = 'today' | 'room';
export function createStudyResourceDemand() {
  let counts = { today: 0, room: 0 };
  const listeners = new Set<() => void>();
  return {
    read: () => counts,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    acquire(resources: readonly StudyResource[]) {
      const unique = [...new Set(resources)];
      const update = (delta: number) => {
        counts = { ...counts };
        for (const resource of unique) counts[resource] += delta;
        listeners.forEach(listener => listener());
      };
      update(1);
      let released = false;
      return () => { if (!released) { released = true; update(-1); } };
    },
  };
}
