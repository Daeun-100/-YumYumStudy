/** Share reads within a generation; mutations invalidate the generation so a
 * post-mutation refresh never reuses a pre-mutation snapshot request. */
export function createSharedRequest() {
  let flight: { generation: number; promise: Promise<void>; next: (() => Promise<void>) | null } | null = null;
  return (generation: number, run: () => Promise<void>, changed = false): Promise<void> => {
    if (flight?.generation === generation) {
      // A database event may arrive after the running query took its snapshot.
      // Queue one trailing read so sharing cannot swallow that change.
      if (changed) flight.next = run;
      return flight.promise;
    }
    const entry = { generation, promise: null as unknown as Promise<void>, next: null as (() => Promise<void>) | null };
    const promise = Promise.resolve().then(async () => {
      let read: (() => Promise<void>) | null = run;
      while (read) {
        entry.next = null;
        await read();
        read = entry.next;
      }
    }).finally(() => {
      if (flight?.promise === promise) flight = null;
    });
    entry.promise = promise;
    flight = entry;
    return promise;
  };
}
