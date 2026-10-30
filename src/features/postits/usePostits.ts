import { usePostitDesigns } from './PostitDesignProvider';
import { useIsFocused } from 'expo-router';
import { measure } from '../../lib/performance';
import { useCallback, useEffect, useRef, useLayoutEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { studyRoomId, withRoomOperation } from '../../lib/room';
import { createSharedRequest } from '../../lib/shared-request';
import { withTimeout } from '../../lib/with-timeout';
import { useIdentity } from '../../components/IdentityProvider';
import { useResourceRefresh } from '../../hooks/useResourceRefresh';
import { useAppActive } from '../../hooks/useAppActive';
import { getStudyDate } from '../../lib/study-day';
import { useScreenNow } from '../study/useScreenNow';
import { decodePostit, mergePostit, type Postit } from './model';

export function usePostits() {
  const focused = useIsFocused();
  const refreshDesigns = usePostitDesigns().refresh;
  const active = useAppActive();
  const { uid, profile } = useIdentity();
  const now = useScreenNow(true, 60000);
  const [notes, setNotes] = useState<Postit[]>([]);
  const [date, setDate] = useState('');
  const [loadedScope, setLoadedScope] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const generation = useRef(0);
  const changes = useRef(0);
  const latestRequest = useRef(0);
  const shared = useRef(createSharedRequest());
  const events = useRef<{ sequence: number; note: Postit }[]>([]);
  const room = studyRoomId;
  const scope = `${room}:${uid ?? ''}`;
  const enabled = !!uid && !!profile && focused && active;
  const current = useRef({ scope, enabled });
  useLayoutEffect(() => { current.current = { scope, enabled }; }, [scope, enabled]);
  const [previousScope, setPreviousScope] = useState(scope);
  if (previousScope !== scope) { setPreviousScope(scope); setNotes([]); setDate(''); setLoadedScope(''); setError(null); }
  const connectionKey = `${scope}:${enabled}`;
  const [previousConnectionKey, setPreviousConnectionKey] = useState(connectionKey);
  if (previousConnectionKey !== connectionKey) { setPreviousConnectionKey(connectionKey); setConnected(false); }
  const load = useCallback((changed = false): Promise<void> => {
    if (!current.current.enabled || current.current.scope !== scope) return Promise.resolve();
    const version = generation.current;
    return shared.current(version, async () => {
      if (!current.current.enabled || current.current.scope !== scope || version !== generation.current) return;
      const seen = changes.current;
      const request = ++latestRequest.current;
      try {
        const data = await withTimeout(measure('postit.load', async () => {
          const result = await getSupabase().rpc('get_room_postits');
          if (result.error) throw result.error;
          return result.data;
        }), 15000, '포스트잇 조회가 지연되고 있어요.');
        if (!current.current.enabled || current.current.scope !== scope || version !== generation.current || request !== latestRequest.current) return;
        if (!data || typeof data.date !== 'string' || !Array.isArray(data.notes)) throw new Error();
        const result: Postit[] = data.notes.map(decodePostit);
        if (result.some(n => n.room_id !== room)) throw new Error();
        setDate(data.date); setLoadedScope(scope);
        void refreshDesigns();
        const duringRequest = events.current.filter(event => event.sequence > seen).map(event => event.note);
        setNotes(previous => [...previous.filter(n => n.deleted_at && n.study_date === data.date), ...duringRequest].reduce(mergePostit, result));
        events.current = events.current.filter(event => event.sequence > seen);
        setError(null);
      } catch (failure) {
        if (current.current.scope === scope && version === generation.current && request === latestRequest.current) setError('포스트잇을 불러오지 못했어요. 잠시 후 다시 연결할게요.');
        throw failure;
      }
    }, changed);
  }, [scope, room, refreshDesigns]);
  const observation = useResourceRefresh({ scope: `${scope}:postits`, enabled, connected, refresh: load });
  const request = observation.request, markFresh = observation.markFresh;
  const refresh = useCallback(async () => { try { await load(); markFresh(); } catch { /* State exposes the error. */ } }, [load, markFresh]);
  useLayoutEffect(() => { events.current = []; }, [scope]);
  useEffect(() => {
    const version = ++generation.current;
    if (!enabled) return;
    const client = getSupabase();
    let disposed = false;
    let channel: ReturnType<typeof client.channel> | undefined;
    void (async () => {
      try {
        await client.realtime.setAuth();
        if (disposed) return;
        channel = client.channel(`postits:room:${room}`, { config: { private: true } })
          .on('broadcast', { event: 'postit' }, ({ payload }) => {
            if (disposed) return;
            try {
              const note = decodePostit(payload);
              if (note.room_id !== room) return;
              if (note.design_revision) void refreshDesigns();
              events.current.push({ sequence: ++changes.current, note });
              setNotes(previous => mergePostit(previous, note));
            } catch { void request(true); }
          }).subscribe(status => {
            if (disposed) return;
            setConnected(status === 'SUBSCRIBED');
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setError('실시간 연결을 다시 시도하고 있어요.');
          });
      } catch { if (!disposed) { setConnected(false); setError('실시간 연결을 다시 시도하고 있어요.'); } }
    })();
    return () => { disposed = true; generation.current = version + 1; if (channel) void client.removeChannel(channel); };
  }, [scope, enabled, room, request, refreshDesigns]);
  const studyDate = now ? getStudyDate(now) : date;
  useEffect(() => { if (enabled && date && studyDate !== date) void request(true); }, [enabled, date, studyDate, request]);
  const mutate = async (name: string, args: Record<string, unknown>) => {
    const version = generation.current;
    return measure(`postit.${name}`, () => withRoomOperation(async () => {
      const { data, error: failure } = await getSupabase().rpc(name, args);
      if (failure) throw new Error(failure.code === '22023' ? failure.message : '저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
      const note = decodePostit(data);
      if (current.current.scope === scope && version === generation.current) { events.current.push({ sequence: ++changes.current, note }); setNotes(previous => mergePostit(previous, note)); }
    }));
  };
  return { notes: loadedScope === scope ? notes.filter(n => n.study_date === studyDate && !n.deleted_at) : [], error, refresh,
    add: (id: string, text: string, color: string, x: number, y: number, designId?: string) => mutate(designId ? 'put_designed_postit' : 'put_room_postit', { p_id: id, p_text: text, p_color: color, p_x: x, p_y: y, ...(designId ? { p_design_id: designId } : {}) }),
    remove: (id: string) => mutate('delete_room_postit', { p_id: id }),
  };
}
