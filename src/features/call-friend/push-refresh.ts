/** Share overlapping registration triggers and retain the latest rotated token. */
export function createPushRefresh<T>(register: (token?: T) => Promise<void>) {
  const flights = new Map<number, { promise: Promise<void>; next?: T }>();
  return (room: number, token?: T): Promise<void> => {
    const active = flights.get(room);
    if (active) {
      if (token !== undefined) active.next = token;
      return active.promise;
    }
    const entry = { promise: null as unknown as Promise<void>, next: undefined as T | undefined };
    entry.promise = Promise.resolve().then(async () => {
      let current = token;
      do {
        entry.next = undefined;
        await register(current);
        current = entry.next;
      } while (current !== undefined);
    }).finally(() => { if (flights.get(room) === entry) flights.delete(room); });
    flights.set(room, entry);
    return entry.promise;
  };
}
