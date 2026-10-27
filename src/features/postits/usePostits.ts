import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { studyRoomId, withRoomOperation } from '../../lib/room';
import { useIdentity } from '../../components/IdentityProvider';
import { useRefreshOnResume } from '../../hooks/useRefreshOnResume';
import { getStudyDate } from '../../lib/study-day';
import { useStudy } from '../study/StudyProvider';
import { decodePostit, mergePostit, type Postit } from './model';

export function usePostits() {
  const { uid, profile } = useIdentity();
  const { now } = useStudy();
  const [notes, setNotes] = useState<Postit[]>([]);
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const changes = useRef(0);
  const latestRequest = useRef(0);
  const events = useRef<{ sequence: number; note: Postit }[]>([]);
  const room = studyRoomId;
  const refresh = useCallback(async () => {
    if (!profile) return;
    const version = generation.current;
    const seen = changes.current;
    const request = ++latestRequest.current;
    try {
      const { data, error: failure } = await getSupabase().rpc('get_room_postits');
      if (failure) throw failure;
      if (version !== generation.current || request !== latestRequest.current) return;
      if (!data || typeof data.date !== 'string' || !Array.isArray(data.notes)) throw new Error();
      const result: Postit[] = data.notes.map(decodePostit);
      if (result.some(n => n.room_id !== room)) throw new Error();
      setDate(data.date);
      // Replay events received during the request over the server snapshot.
      const duringRequest = events.current.filter(event => event.sequence > seen).map(event => event.note);
      setNotes(previous => [...previous.filter(n => n.deleted_at && n.study_date === data.date), ...duringRequest].reduce(mergePostit, result));
      events.current = events.current.filter(event => event.sequence > seen);
      setError(null);
    } catch {
      if (version === generation.current && request === latestRequest.current) setError('포스트잇을 불러오지 못했어요. 잠시 후 다시 연결할게요.');
    }
  }, [profile, room]);
  const resume = useRefreshOnResume(refresh, !!profile);
  useEffect(() => {
    const version = ++generation.current;
    if (!uid || !profile) return;
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
              events.current.push({ sequence: ++changes.current, note });
              setNotes(previous => mergePostit(previous, note));
            } catch { void refresh(); }
          }).subscribe(status => {
            if (disposed) return;
            if (status === 'SUBSCRIBED') void refresh();
            else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setError('실시간 연결을 다시 시도하고 있어요.');
          });
      } catch { if (!disposed) setError('실시간 연결을 다시 시도하고 있어요.'); }
    })();
    const initial = setTimeout(() => { void refresh(); }, 0);
    // Recover missed events and cross the 6am day boundary without reopening.
    const timer = setInterval(resume, 15000);
    return () => { disposed = true; generation.current = version + 1; clearTimeout(initial); clearInterval(timer); if (channel) void client.removeChannel(channel); };
  }, [uid, profile, room, refresh, resume]);
  const mutate = async (name: string, args: Record<string, unknown>) => {
    const version = generation.current;
    return withRoomOperation(async () => {
      const { data, error: failure } = await getSupabase().rpc(name, args);
      if (failure) throw new Error(failure.code === '22023' ? failure.message : '저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
      const note = decodePostit(data);
      if (version === generation.current) { events.current.push({ sequence: ++changes.current, note }); setNotes(previous => mergePostit(previous, note)); }
    });
  };
  return { notes: notes.filter(n => n.study_date === (now ? getStudyDate(now) : date) && !n.deleted_at), error, refresh,
    add: (id: string, text: string, color: string, x: number, y: number) => mutate('put_room_postit', { p_id: id, p_text: text, p_color: color, p_x: x, p_y: y }),
    remove: (id: string) => mutate('delete_room_postit', { p_id: id }),
  };
}
