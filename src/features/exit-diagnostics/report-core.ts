export type ExitReport = { id: string; [key: string]: unknown };
type Dependencies = {
  pending(): Promise<string>;
  send(event: ExitReport): Promise<void>;
  acknowledge(ids: string[]): Promise<void>;
};

/** A durable native outbox is acknowledged only after the idempotent server insert succeeds. */
export function createExitReporter(deps: Dependencies) {
  let flight: Promise<void> | undefined;
  return (): Promise<void> => {
    if (flight) return flight;
    flight = (async () => {
      const pending: unknown = JSON.parse(await deps.pending());
      if (!Array.isArray(pending) || pending.length > 16) throw new Error('Invalid diagnostic queue');
      for (const event of pending) {
        if (!event || typeof event !== 'object' || typeof event.id !== 'string') throw new Error('Invalid diagnostic');
        await deps.send(event);
        await deps.acknowledge([event.id]);
      }
    })().finally(() => { flight = undefined; });
    return flight;
  };
}
