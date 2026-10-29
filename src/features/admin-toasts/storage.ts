import { UUID } from './model.ts';
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
/** No message text is persisted. Serialized writes prevent lost completion markers. */
export function createToastHistory(storage: Storage, newId: () => string) {
  let installation: Promise<string> | undefined;
  const scopes = new Map<string, Promise<Map<string, number>>>();
  let writes = Promise.resolve();
  const key = (scope: string) => `admin-toasts:v1:completed:${scope}`;
  const load = (scope: string) => {
    if (!scopes.has(scope)) scopes.set(scope, (async () => {
      try {
        const parsed = JSON.parse(await storage.getItem(key(scope)) ?? '{}');
        return new Map<string, number>(Object.entries(parsed).filter(([id, expiry]) => UUID.test(id) && typeof expiry === 'number' && expiry > Date.now()) as [string, number][]);
      } catch { console.warn('admin_toast_history_read_failed'); return new Map<string, number>(); }
    })());
    return scopes.get(scope)!;
  };
  return {
    load,
    installationId() {
      installation ??= (async () => {
        try {
          const old = await storage.getItem('admin-toasts:installation');
          if (old && UUID.test(old)) return old;
        } catch { console.warn('admin_toast_installation_read_failed'); }
        const id = newId();
        try { await storage.setItem('admin-toasts:installation', id); } catch { console.warn('admin_toast_installation_write_failed'); }
        return id;
      })();
      return installation;
    },
    async complete(scope: string, id: string, expires: number) {
      const values = await load(scope); values.set(id, expires + 7 * 86400000);
      writes = writes.then(async () => {
        for (const [k, expiry] of values) if (expiry < Date.now()) values.delete(k);
        try { await storage.setItem(key(scope), JSON.stringify(Object.fromEntries(values))); } catch { console.warn('admin_toast_history_write_failed'); }
      });
      await writes;
    },
  };
}
