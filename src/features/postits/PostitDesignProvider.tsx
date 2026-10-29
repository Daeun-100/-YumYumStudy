import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type PropsWithChildren } from 'react';
import { useIdentity } from '../../components/IdentityProvider';
import { useAppActive } from '../../hooks/useAppActive';
import { callRpc } from '../../data/rpc';
import { useToast } from '../../design/toast';
import { studyRoomId } from '../../lib/room';
import { useStudy } from '../study/StudyProvider';
import { prepareArtworkFile } from '../artwork/ArtworkProvider';
import { decodeOwnedDesigns, decodeVisibleDesigns, type OwnedPostitDesign, type PostitArtwork } from './designs';

type State = { owned: OwnedPostitDesign[]; visible: PostitArtwork[]; error: string | null; refresh(): Promise<void> };
const empty: State = { owned: [], visible: [], error: null, refresh: async () => {} };
const Context = createContext<State>(empty);
export const usePostitDesigns = () => useContext(Context);
export function PostitDesignProvider({ children }: PropsWithChildren) {
  const { profile } = useIdentity(), active = useAppActive(), study = useStudy(), toast = useToast();
  const owner = profile?.id, room = studyRoomId, scope = `${owner ?? ''}:${room}`;
  const current = useRef({ scope, active, owner });
  useLayoutEffect(() => { current.current = { scope, active, owner }; }, [scope, active, owner]);
  const [data, setData] = useState<{ scope: string; owned: OwnedPostitDesign[]; visible: PostitArtwork[]; error: string | null }>({ scope, ...empty });
  const [schedule, setSchedule] = useState<{ scope: string; at: number } | null>(null);
  const flights = useRef(new Map<string, Promise<void>>());
  const trailing = useRef(new Set<string>());
  const prepared = useRef(new Set<string>());
  const epoch = useRef(0);
  const syncedEpoch = useRef(-1);
  useLayoutEffect(() => { const version = ++epoch.current; return () => { epoch.current = version + 1; }; }, [scope]);
  const refresh = useCallback(function refreshCurrent(): Promise<void> {
    if (!owner || !current.current.active || current.current.scope !== scope) return Promise.resolve();
    const version = epoch.current, flightKey = `${scope}:${version}`;
    const existing = flights.current.get(flightKey); if (existing) { trailing.current.add(flightKey); return existing; }
    const task = (async () => {
      try {
        const raw = await callRpc('sync_postit_designs', { p_room_id: room }) as Record<string, unknown>;
        if (!raw || !Array.isArray(raw.owned) || typeof raw.serverNow !== 'string') throw Error('Invalid design response');
        const owned = decodeOwnedDesigns(raw.owned), visible = decodeVisibleDesigns(raw.visible);
        if (current.current.scope !== scope || epoch.current !== version) return;
        syncedEpoch.current = version;
        setData({ scope, owned, visible, error: null });
        const wait = raw.nextCheckSeconds;
        setSchedule(typeof wait === 'number' && Number.isFinite(wait) && wait > 0 ? { scope, at: Date.now() + Math.ceil(wait * 1000) + 250 } : null);
        void AsyncStorage.setItem(`postit-designs-v1:${scope}`, JSON.stringify({ owned, visible })).catch(() => {});
        for (const m of [...owned.map(x => x.artwork), ...visible]) {
          for (const file of [m.paper, ...(m.preview ? [m.preview] : [])]) {
          const key = `${file.path}:${file.sha256}`;
          if (!prepared.current.has(key)) void prepareArtworkFile(file).then(() => {
            prepared.current.add(key);
            if (prepared.current.size > 200) prepared.current.delete(prepared.current.values().next().value!);
          }).catch(() => {});
          }
        }
      } catch {
        if (current.current.scope === scope && epoch.current === version) setData(old => ({ ...(old.scope === scope ? old : { scope, ...empty }), error: '종이 디자인을 불러오지 못했어요. 다시 시도해 주세요.' }));
      }
    })().finally(() => {
      if (flights.current.get(flightKey) === task) flights.current.delete(flightKey);
      if (trailing.current.delete(flightKey) && current.current.scope === scope && epoch.current === version) void refreshCurrent();
    });
    flights.current.set(flightKey, task); return task;
  }, [owner, room, scope]);
  useEffect(() => {
    let disposed = false;
    const version = epoch.current;
    if (owner) void AsyncStorage.getItem(`postit-designs-v1:${scope}`).then(text => {
      if (!text || disposed || current.current.scope !== scope || version !== epoch.current || syncedEpoch.current === version) return;
      try {
        const cache = JSON.parse(text), owned = decodeOwnedDesigns(cache.owned), visible = decodeVisibleDesigns(cache.visible);
        setData(old => old.scope === scope && old.owned.length ? old : { scope, owned, visible, error: old.scope === scope ? old.error : null });
      } catch { /* Replace malformed caches on the next successful read. */ }
    }).catch(() => {});
    return () => { disposed = true; };
  }, [owner, scope]);
  useEffect(() => { if (active && owner && !study.busy) void refresh(); }, [active, owner, refresh, study.today, study.busy]);
  useEffect(() => {
    if (!active || !schedule || schedule.scope !== scope) return;
    const timer = setTimeout(() => { void refresh(); }, Math.min(2_000_000_000, Math.max(0, schedule.at - Date.now())));
    return () => clearTimeout(timer);
  }, [active, schedule, scope, refresh]);
  const owned = data.scope === scope ? data.owned : empty.owned;
  useEffect(() => {
    let disposed = false;
    if (!active || !owner) return;
    for (const item of owned) {
      const key = `postit-design-notice-v1:${owner}:${item.grantId}`;
      void AsyncStorage.getItem(key).then(seen => {
        if (seen || disposed || current.current.scope !== scope || !current.current.active) return;
        toast.show({ title: `${item.artwork.name}을 받았어요!`, message: '포스트잇을 쓸 때 종이 디자인에서 선택해 보세요.', tone: 'reward', dedupeKey: key,
          onShow: () => { void AsyncStorage.setItem(key, '1').catch(() => {}); } });
      }).catch(() => {});
    }
    return () => { disposed = true; };
  }, [owned, active, owner, scope, toast]);
  return <Context.Provider value={{ ...(data.scope === scope ? data : empty), refresh }}>{children}</Context.Provider>;
}
