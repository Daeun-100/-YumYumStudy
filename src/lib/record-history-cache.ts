import { decodeHistory, decodeSnapshot } from '../data/decode.ts';
import { getStudyDayBounds } from './study-day.ts';

type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
type Entry = { key: string; savedAt: number; value: ReturnType<typeof decode> };
const storageKey = 'yumyumstudy.record-history.v1';
const lifetime = 7 * 86400000;

function rangeFor(key: string): [string, string] | null {
  try {
    const parts = JSON.parse(key);
    if (!Array.isArray(parts) || parts.length !== 5 || ![0, 1].includes(parts[0])
      || typeof parts[1] !== 'string' || !parts[1] || parts[2] !== 'history') return null;
    const from = getStudyDayBounds(parts[3]).startMs;
    const to = getStudyDayBounds(parts[4]).startMs;
    return from <= to && to - from <= 365 * 86400000 ? [parts[3], parts[4]] : null;
  } catch { return null; }
}
function decode(value: unknown) { return decodeSnapshot(value, decodeHistory); }
function checked(key: string, value: unknown) {
  const range = rangeFor(key);
  if (!range) throw Error('Unsupported record cache key');
  const snapshot = decode(value);
  const dates = snapshot.data.map(day => day.studyDate);
  if (dates.length > 366 || new Set(dates).size !== dates.length || dates.some(date => date < range[0] || date > range[1])) throw Error('Invalid cached period');
  return snapshot;
}

/** Display-only own-history snapshots. No active session, pending action or
 * friend authorization is restored from disk. Storage failure is non-fatal. */
export function createRecordHistoryCache(storage: Storage, now = Date.now, limit = 24) {
  const entries = new Map<string, Entry>();
  let loaded: Promise<void> | null = null;
  let writes = Promise.resolve();
  function load() {
    return loaded ??= (async () => {
      try {
        const raw = await storage.getItem(storageKey);
        if (!raw || raw.length > 1_000_000) return;
        const parsed = JSON.parse(raw);
        if (parsed.version !== 1 || !Array.isArray(parsed.entries)) return;
        for (const row of parsed.entries.slice(-limit)) {
          try {
            if (!Number.isFinite(row.savedAt) || now() - row.savedAt > lifetime || row.savedAt > now()) continue;
            entries.set(row.key, { key: row.key, savedAt: row.savedAt, value: checked(row.key, row.value) });
          } catch { /* Ignore an invalid entry without discarding valid periods. */ }
        }
      } catch { /* Offline history is optional; live reads still proceed. */ }
    })();
  }
  return {
    async load(key: string): Promise<unknown | undefined> {
      if (!rangeFor(key)) return undefined;
      await load();
      const entry = entries.get(key);
      return entry && now() - entry.savedAt <= lifetime ? entry.value : undefined;
    },
    async save(key: string, value: unknown): Promise<void> {
      if (!rangeFor(key)) return;
      try {
        const snapshot = checked(key, value);
        await load();
        const previous = entries.get(key);
        if (previous && Date.parse(previous.value.serverNow) > Date.parse(snapshot.serverNow)) return;
        entries.delete(key);
        entries.set(key, { key, savedAt: now(), value: snapshot });
        while (entries.size > limit) entries.delete(entries.keys().next().value!);
        writes = writes.catch(() => {}).then(() => storage.setItem(storageKey, JSON.stringify({ version: 1, entries: [...entries.values()] })));
        await writes;
      } catch { /* Never turn a successful server read into a cache error. */ }
    },
  };
}
