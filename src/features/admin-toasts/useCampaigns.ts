import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { useResourceRefresh } from '../../hooks/useResourceRefresh';
import { useAppActive } from '../../hooks/useAppActive';
import { withTimeout } from '../../lib/with-timeout';
import { decodeCampaign, type Campaign } from './model';
export function useCampaigns(scope: string, room: number, enabled: boolean) {
  const active = useAppActive();
  const [authAttempt, setAuthAttempt] = useState(0);
  const authDelay = useRef(5000);
  const session = useMemo(() => ({ scope, enabled, active }), [scope, enabled, active]);
  const [connection, setConnection] = useState<{ session: typeof session; connected: boolean } | null>(null);
  const connected = connection?.session === session && connection.connected;
  const [snapshot, setSnapshot] = useState<{ scope: string; session: typeof session; campaigns: Campaign[]; serverNow: number; observedAt: number } | null>(null);
  const owner = useRef(session), changes = useRef(0);
  useLayoutEffect(() => { owner.current = session; changes.current++; }, [session]);
  const refresh = useCallback(async () => {
    const version = changes.current, requestStarted = performance.now();
    const result = await withTimeout(Promise.resolve(getSupabase().rpc('get_admin_toasts')), 15000, 'Admin toast read timeout');
    if (result.error) throw result.error;
    if (owner.current !== session || version !== changes.current) return;
    const data = result.data;
    if (!data || !Array.isArray(data.campaigns) || !Number.isFinite(Date.parse(data.server_now))) throw Error('Invalid toast snapshot');
    setSnapshot({ scope, session, campaigns: data.campaigns.map(decodeCampaign).filter((c: Campaign | null): c is Campaign => !!c),
      serverNow: Date.parse(data.server_now), observedAt: requestStarted });
  }, [scope, session]);
  const { request } = useResourceRefresh({ scope: `${scope}:${enabled}:${active}:admin-toasts`, enabled, connected, refresh });
  useEffect(() => {
    if (!enabled || !active) return;
    const client = getSupabase(); let disposed = false;
    let channel: ReturnType<typeof client.channel> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      try {
        await client.realtime.setAuth();
        if (disposed) return;
        channel = client.channel(`admin-toasts:room:${room}`, { config: { private: true } })
          .on('broadcast', { event: 'changed' }, () => { if (!disposed) { changes.current++; void request(true); } })
          .subscribe(status => { if (!disposed) { setConnection({ session, connected: status === 'SUBSCRIBED' }); if (status === 'SUBSCRIBED') { authDelay.current = 5000; changes.current++; void request(true); } } });
      } catch {
        console.warn('admin_toast_realtime_failed');
        if (!disposed) {
          retry = setTimeout(() => { if (!disposed) setAuthAttempt(n => n + 1); }, authDelay.current);
          authDelay.current = Math.min(60000, authDelay.current * 2);
        }
      }
    })();
    return () => { disposed = true; clearTimeout(retry); if (channel) void client.removeChannel(channel); };
  }, [scope, room, enabled, active, request, session, authAttempt]);
  return snapshot?.session === session ? snapshot : null;
}
