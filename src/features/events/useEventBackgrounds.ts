import { ArtworkContext } from '../artwork/ArtworkContext';
import { useContext, useEffect, useState } from 'react';
import { useIdentity } from '../../components/IdentityProvider';
import { useAppActive } from '../../hooks/useAppActive';
import { callRpc } from '../../data/rpc';
import { getSupabase } from '../../lib/supabase';
import { studyRoomId } from '../../lib/room';
import { decodeEventBackgrounds, selectEventBackgrounds, type EventBackgroundSnapshot } from '../../lib/event-backgrounds';

type Cached = { snapshot: EventBackgroundSnapshot };
const cache = new Map<string, Cached>();
let subscription = 0;
export function useEventBackgrounds(focused: boolean) {
  const identity = useIdentity();
  const artworkStore = useContext(ArtworkContext);
  const active = useAppActive();
  const room = studyRoomId;
  const owner = identity.profile?.id;
  const key = owner ? `${owner}:${room}` : '';
  const [state, setState] = useState<{ key: string; value?: Cached }>({ key });
  const value = state.key === key ? state.value ?? cache.get(key) : cache.get(key);
  // Use the last successful server response until Realtime or screen activation refreshes it.
  const now = value ? Date.parse(value.snapshot.serverNow) : 0;
  const selection = selectEventBackgrounds(value?.snapshot.windows ?? [], now);

  useEffect(() => {
    if (!key || !active || !focused) return;
    let disposed = false, fetching = false, again = false;
    const client = getSupabase();
    const refresh = async () => {
      if (fetching) { again = true; return; }
      fetching = true;
      try {
        const snapshot = decodeEventBackgrounds(await callRpc('get_event_backgrounds', { p_room_id: room }));
        if (disposed || snapshot.roomId !== room) return;
        const result = { snapshot };
        for (const window of snapshot.windows) if(window.artwork) void artworkStore?.ingest(window.artwork);
        cache.set(key, result);
        // Only retain the current user's room snapshots in memory.
        for (const storedKey of cache.keys()) if (!storedKey.startsWith(`${owner}:`)) cache.delete(storedKey);
        setState({ key, value: result });
      } catch { /* Keep the last verified background until a refresh succeeds. */ }
      finally {
        fetching = false;
        if (again && !disposed) { again = false; void refresh(); }
      }
    };
    void refresh();
    const channel = client.channel(`event-backgrounds-${++subscription}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'event_background_versions', filter: `room_id=eq.${room}` }, () => { void refresh(); })
      .subscribe(status => { if (status === 'SUBSCRIBED') void refresh(); });
    return () => { disposed = true; void client.removeChannel(channel).catch(() => {}); };
  }, [key, room, active, focused, owner, artworkStore]);

  return selection;
}
