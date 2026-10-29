export type VersionReport = {
  platform: 'android' | 'ios' | 'web';
  appVersion: string | null;
  buildVersion: string | null;
  updateId: string | null;
  runtimeVersion: string | null;
  embedded: boolean | null;
  webBuildId: string | null;
  appVariant: 'production' | 'test';
};

/** One successful snapshot per user; failures never consume the throttle window. */
export function createVersionReporter(send: (report: VersionReport) => Promise<void>, now = Date.now) {
  const users = new Map<string, { flight?: Promise<void>; fingerprint?: string; reportedAt?: number }>();
  return (userKey: string, report: VersionReport): Promise<void> => {
    const entry = users.get(userKey) ?? {};
    users.set(userKey, entry);
    if (entry.flight) return entry.flight;
    const fingerprint = JSON.stringify(report);
    if (entry.fingerprint === fingerprint && entry.reportedAt !== undefined
      && now() >= entry.reportedAt && now() - entry.reportedAt < 15 * 60 * 1000) return Promise.resolve();
    entry.flight = Promise.resolve().then(() => send(report)).then(() => {
      entry.fingerprint = fingerprint;
      entry.reportedAt = now();
    }).finally(() => { entry.flight = undefined; });
    return entry.flight;
  };
}
