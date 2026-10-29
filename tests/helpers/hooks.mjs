/** Small deterministic hook runtime for the existing VM component tests. */
export function createHookRuntime() {
  const slots = [];
  const layouts = new Map(), effects = new Map();
  let cursor = 0, rendering = false, again = false;
  const changed = (old, deps) => !old || deps.some((dep, i) => dep !== old.deps[i]);
  const effect = (queue, run, deps) => {
    const index = cursor++;
    if (changed(slots[index], deps)) {
      const cleanup = slots[index]?.cleanup;
      slots[index] = { deps, cleanup };
      queue.set(index, () => { cleanup?.(); slots[index].cleanup = run(); });
    }
  };
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useContext: context => context.value,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => {
        const next = typeof value === 'function' ? value(slots[index]) : value;
        if (rendering && !Object.is(next, slots[index])) again = true;
        slots[index] = next;
      }];
    },
    useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
    useMemo(factory, deps) {
      const index = cursor++;
      if (changed(slots[index], deps)) slots[index] = { value: factory(), deps };
      return slots[index].value;
    },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect: (run, deps) => effect(effects, run, deps),
    useLayoutEffect: (run, deps) => effect(layouts, run, deps),
    useSyncExternalStore: (_subscribe, read) => read(),
  };
  return {
    react,
    render(render) {
      let value, attempts = 0;
      do {
        if (++attempts > 10) throw Error('Render loop in hook test');
        cursor = 0; again = false; rendering = true;
        value = render(); rendering = false;
      } while (again);
      for (const queue of [layouts, effects]) { const work = [...queue.values()]; queue.clear(); work.forEach(run => run()); }
      return value;
    },
    dispose() { for (const slot of slots) slot?.cleanup?.(); },
  };
}
