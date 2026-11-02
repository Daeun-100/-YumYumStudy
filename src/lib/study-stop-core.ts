type Stop = { sessionId: string; stoppedAt: string };
type Storage = { getItem(key: string): string | null | Promise<string | null>; setItem(key: string, value: string): void | Promise<void>; removeItem(key: string): void | Promise<void> };
/** Persist the event, not a newly computed timestamp on each retry. */
export function createStopOutbox(storage: Storage, key: string) {
  const read = async (): Promise<Stop | null> => {
    const raw = await storage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Stop;
    if (!/^[0-9a-f-]{36}$/i.test(value.sessionId) || !Number.isFinite(Date.parse(value.stoppedAt))) throw new Error('Invalid saved stop');
    return value;
  };
  const acknowledge = async (event: Stop) => {
    if (JSON.stringify(await read()) === JSON.stringify(event)) await storage.removeItem(key);
  };
  return { read, acknowledge,
    async save(value: Stop) {
      const old = await read();
      if (old && old.sessionId !== value.sessionId) throw new Error('Previous stop is pending');
      const event = old && Date.parse(old.stoppedAt) <= Date.parse(value.stoppedAt) ? old : value;
      await storage.setItem(key, JSON.stringify(event));
      return event;
    },
    async flush(send: (event: Stop) => Promise<unknown>) {
      const event = await read();
      if (!event) return;
      await send(event);
      await acknowledge(event);
    },
  };
}
