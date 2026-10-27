type Store = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

// Only Supabase credentials move; layout caches and pending operations stay put.
export function createSecureSessionStorage(legacy: Store, secure: Store, newId: () => string) {
  const pending = new Map<string, Promise<unknown>>();
  function serial<T>(key: string, run: () => Promise<T>): Promise<T> {
    const task = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(run);
    pending.set(key, task);
    void task.finally(() => { if (pending.get(key) === task) pending.delete(key); }).catch(() => {});
    return task;
  }
  const protectedKey = (key: string) => /^sb-.+-auth-token(?:-.*)?$/.test(key);
  const baseKey = (key: string) => `session-v1.${key}`;
  type Manifest = { version: string; count: number };
  async function manifest(key: string): Promise<Manifest | null> {
    const raw = await secure.getItem(baseKey(key));
    if (raw === null) return null;
    const value = JSON.parse(raw) as Manifest;
    if (!/^[\w-]+$/.test(value.version) || !Number.isSafeInteger(value.count) || value.count < 1 || value.count > 1000) {
      throw new Error('보안 저장소의 인증 정보를 확인하지 못했어요.');
    }
    return value;
  }
  const chunkKey = (key: string, m: Manifest, i: number) => `${baseKey(key)}.${m.version}.${i}`;
  async function read(key: string, m: Manifest): Promise<string> {
    const chunks: string[] = [];
    for (let i = 0; i < m.count; i++) {
      const chunk = await secure.getItem(chunkKey(key, m, i));
      if (chunk === null) throw new Error('보안 저장소의 인증 정보가 불완전해요.');
      chunks.push(chunk);
    }
    return chunks.join('');
  }
  async function discard(key: string, m: Manifest) {
    for (let i = 0; i < m.count; i++) await secure.removeItem(chunkKey(key, m, i));
  }
  async function write(key: string, value: string, previous: Manifest | null) {
    // Small encrypted chunks avoid platform limits on individual Keychain values.
    const characters = Array.from(value);
    const next = { version: newId(), count: Math.max(1, Math.ceil(characters.length / 400)) };
    if (next.count > 1000) throw new Error('인증 정보가 너무 커요.');
    for (let i = 0; i < next.count; i++) await secure.setItem(chunkKey(key, next, i), characters.slice(i * 400, (i + 1) * 400).join(''));
    if (await read(key, next) !== value) throw new Error('인증 정보의 안전한 저장을 확인하지 못했어요.');
    // Publish last: an interrupted write cannot replace the last complete session.
    await secure.setItem(baseKey(key), JSON.stringify(next));
    if (await read(key, (await manifest(key))!) !== value) throw new Error('인증 정보의 안전한 저장을 확인하지 못했어요.');
    await legacy.removeItem(key);
    if (previous) await discard(key, previous);
  }
  return {
    getItem(key: string): Promise<string | null> {
      if (!protectedKey(key)) return legacy.getItem(key);
      return serial(key, async () => {
        const current = await manifest(key);
        if (current) {
          const value = await read(key, current);
          await legacy.removeItem(key);
          return value;
        }
        const value = await legacy.getItem(key);
        if (value !== null) await write(key, value, null);
        return value;
      });
    },
    setItem(key: string, value: string): Promise<void> {
      if (!protectedKey(key)) return legacy.setItem(key, value);
      return serial(key, async () => write(key, value, await manifest(key)));
    },
    removeItem(key: string): Promise<void> {
      if (!protectedKey(key)) return legacy.removeItem(key);
      return serial(key, async () => {
        const current = await manifest(key);
        // Remove legacy first so a partial deletion cannot resurrect old tokens.
        await legacy.removeItem(key);
        await secure.removeItem(baseKey(key));
        if (current) await discard(key, current);
      });
    },
  };
}
