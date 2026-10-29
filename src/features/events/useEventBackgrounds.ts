import { useEffect, useRef, useState } from 'react';
import { useIdentity } from '../../components/IdentityProvider';
import { useAppActive } from '../../hooks/useAppActive';
import { callRpc } from '../../data/rpc';
import { getSupabase } from '../../lib/supabase';
import { studyRoomId } from '../../lib/room';
import { decodeEventBackgrounds, selectEventBackgrounds, type EventBackgroundSnapshot } from '../../lib/event-backgrounds';

type Cached = { snapshot: EventBackgroundSnapshot; offset: number };
const cache = new Map<string, Cached>();
let subscription = 0;
export function useEventBackgrounds(focused: boolean) {
  const identity = useIdentity();
  const active = useAppActive();
  const room = studyRoomId;
  const owner = identity.profile?.id;
  const key = owner ? `${owner}:${room}` : '';
  const refreshRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<{ key: string; value?: Cached }>({ key });
  const [tick, setTick] = useState(0);
  const [wallNow, setWallNow] = useState(() => Date.now());
  const value = state.key === key ? state.value ?? cache.get(key) : cache.get(key);
  const now = wallNow + (value?.offset ?? 0);
  const selection = selectEventBackgrounds(value?.snapshot.windows ?? [], now);

  useEffect(() => {
    if (!key || !active || !focused) return;
    let disposed = false, fetching = false, again = false;
    const client = getSupabase();
    const refresh = async () => {
      if (fetching) { again = true; return; }
      fetching = true;
      try {
        const sent = Date.now();
        const snapshot = decodeEventBackgrounds(await callRpc('get_event_backgrounds', { p_room_id: room }));
        if (disposed || snapshot.roomId !== room) return;
        const result = { snapshot, offset: Date.parse(snapshot.serverNow) - (sent + Date.now()) / 2 };
        cache.set(key, result);
        // Only retain the current user's room snapshots in memory.
        for (const storedKey of cache.keys()) if (!storedKey.startsWith(`${owner}:`)) cache.delete(storedKey);
        setState({ key, value: result });
        setWallNow(Date.now());
      } catch { /* Keep the last verified window; its expiry still applies offline. */ }
      finally {
        fetching = false;
        if (again && !disposed) { again = false; void refresh(); }
      }
    };
    refreshRef.current = () => { void refresh(); };
    void refresh();
    const channel = client.channel(`event-backgrounds-${++subscription}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'event_background_versions', filter: `room_id=eq.${room}` }, () => { void refresh(); })
      .subscribe(status => { if (status === 'SUBSCRIBED') void refresh(); });
    return () => { disposed = true; refreshRef.current = null; void client.removeChannel(channel).catch(() => {}); };
  }, [key, room, active, focused, owner]);

  useEffect(() => {
    if (!active || !focused) return;
    const timer = setTimeout(() => setWallNow(Date.now()), 0);
    return () => clearTimeout(timer);
  }, [active, focused, key]);

  useEffect(() => { if (tick > 0) refreshRef.current?.(); }, [tick]);

  useEffect(() => {
    if (!active || !focused || selection.nextAt === null) return;
    // A long deadline may exceed the native timer limit. Chunk without querying.
    const wait = Math.min(Math.max(1, selection.nextAt - now + 20), 2147483647);
    const timer = setTimeout(() => { setWallNow(Date.now()); setTick(t => t + 1); }, wait);
    return () => clearTimeout(timer);
  }, [active, focused, selection.nextAt, value, tick, now]);
  return selection;
}
