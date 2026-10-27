type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
export function createTimerMode(storage: Storage, room: () => number) {
  const key = (owner: string) => `yumyumstudy.basic-study.${room()}.${owner}`;
  return {
    get: (owner: string) => storage.getItem(key(owner)),
    set: (owner: string, session: string) => storage.setItem(key(owner), session),
    clear: (owner: string) => storage.removeItem(key(owner)),
  };
}
export function needsStudyGuard(status: { usageAccess: boolean; notificationAccess: boolean; allowed: string[] } | null, basic: string | null) {
  return !basic && !!status && status.usageAccess && status.notificationAccess && status.allowed.length > 0;
}
export function isBasicSession(basic: string | null, sessionId: string) {
  return basic === '*' || basic === sessionId;
}
