import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import { useIdentity } from '../../components/IdentityProvider';
import { useStartupVisible } from '../../components/StartupBoundary';
import { useToast } from '../../design/toast';
import { activeRoomOperations, isTestBuild, roomSwitching, studyRoomId } from '../../lib/room';
import { getSupabase } from '../../lib/supabase';
import { useStudy } from '../study/StudyProvider';
import { useLeave } from '../leave/LeaveProvider';
import { useOtaUpdate } from '../ota/OtaUpdateProvider';
import { isUpdateReloading } from '../ota/reload-gate';
import { eligible, orderCampaigns, type Campaign } from './model';
import { createToastHistory } from './storage';
import { useCampaigns } from './useCampaigns';
import { UpdateToastAction } from './UpdateToast';
import { UpdateDestinationProvider, useUpdateDestination } from './UpdateDestination';

// Read on every render, but only subscribe to ticks while an unfinished notice needs time checks.
const readClock = () => Math.floor(performance.now() / 1000) * 1000;
function useToastClock(observe: boolean) {
  const subscribe = useCallback((notify: () => void) => {
    if (!observe) return () => {};
    const timer = setInterval(notify, 1000);
    return () => clearInterval(timer);
  }, [observe]);
  return useSyncExternalStore(subscribe, readClock, readClock);
}

const history = createToastHistory(AsyncStorage, randomUUID);
export function AdminToastProvider({ children }: PropsWithChildren) {
  return <UpdateDestinationProvider>{children}<AdminToasts /></UpdateDestinationProvider>;
}
function AdminToasts() {
  const identity = useIdentity(), study = useStudy(), leave = useLeave(), ota = useOtaUpdate();
  const startup = useStartupVisible(), toast = useToast();
  const scope = `${studyRoomId}:${identity.uid ?? ''}`;
  const enabled = startup && !!identity.uid && !!identity.profile && !identity.loading && !identity.error;
  const snapshot = useCampaigns(scope, studyRoomId, enabled);
  const [active, setActive] = useState<Campaign | null>(null);
  const [loaded, setLoaded] = useState<{ scope: string; completed: Map<string, number>; installation: string } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void Promise.all([history.load(scope), history.installationId()]).then(([completed, installation]) => { if (alive) setLoaded({ scope, completed, installation }); });
    return () => { alive = false; };
  }, [enabled, scope]);
  const context = { room: studyRoomId, platform: Platform.OS, variant: isTestBuild ? 'test' : 'production', ota: ota.target };
  const hasPending = loaded?.scope === scope && !!snapshot?.campaigns.some(c =>
    (active?.id === c.id || !loaded.completed.has(c.id)) && eligible(c, { ...context, now: Date.parse(c.starts_at) }));
  const clock = useToastClock(enabled && toast.environment.active && hasPending);
  const age = snapshot ? Math.max(0, clock - snapshot.observedAt) : Infinity;
  const ready = enabled && loaded?.scope === scope && toast.environment.ready && toast.environment.active && !toast.environment.blocked
    && study.startupReady && !!study.today && !study.today.data.activeSession && !study.busy && !study.error && !study.actionFailed && !study.startupError
    && !leave.busy && !leave.error && !leave.actionFailed && !roomSwitching && activeRoomOperations === 0 && !isUpdateReloading() && age < 90000;
  const candidates = ready && snapshot ? orderCampaigns(snapshot.campaigns).filter(c => eligible(c, { ...context, now: snapshot.serverNow + age })) : [];
  const current = active && candidates.find(c => c.id === active.id);
  const candidate = current ?? candidates.find(c => !loaded?.completed.has(c.id));
  if (active?.id !== candidate?.id) setActive(candidate ?? null);
  const binding = useMemo(() => ({ scope }), [scope]);
  const owner = useRef(binding);
  useLayoutEffect(() => { owner.current = binding; }, [binding]);
  if (!ready || !current || !loaded) return null;
  const report = (event: 'shown' | 'close' | 'destination') => {
    if (owner.current !== binding) return;
    void getSupabase().rpc('record_admin_toast', { p_campaign_id: current.id, p_installation_id: loaded.installation, p_event: event })
      .then(({ error }) => { if (error) console.warn('admin_toast_receipt_failed'); }, () => { console.warn('admin_toast_receipt_failed'); });
  };
  const complete = async (reason: 'shown' | 'close' | 'destination') => {
    if (owner.current !== binding) return;
    // Mark memory before asynchronous persistence or callbacks can run again.
    loaded.completed.set(current.id, Date.parse(current.expires_at) + 7 * 86400000);
    await history.complete(scope, current.id, Date.parse(current.expires_at));
    report(reason);
  };
  return <CampaignToast key={`${scope}:${current.id}`} campaign={current} onShown={() => {
    if (current.kind === 'info_notice') void complete('shown'); else report('shown');
  }} onComplete={complete} onFinish={() => setActive(null)} />;
}
function CampaignToast({ campaign, onShown, onComplete, onFinish }: {
  campaign: Campaign; onShown(): void; onComplete(reason: 'shown' | 'close' | 'destination'): Promise<void>; onFinish(): void;
}) {
  const { show, dismiss } = useToast();
  const destination = useUpdateDestination();
  const latest = useRef({ onShown, onComplete, onFinish, destination });
  useLayoutEffect(() => { latest.current = { onShown, onComplete, onFinish, destination }; }, [onShown, onComplete, onFinish, destination]);
  const campaignId = campaign.id, kind = campaign.kind, title = campaign.payload.title, message = campaign.payload.message;
  const id = `admin-toast:${campaignId}`;
  const [attempt, setAttempt] = useState(0);
  const terminal = useRef(false);
  useEffect(() => {
    let alive = true, retry: ReturnType<typeof setTimeout> | undefined;
    const close = (reason: 'close' | 'destination') => {
      if (!alive || terminal.current) return;
      terminal.current = true;
      void latest.current.onComplete(reason).catch(() => console.warn('admin_toast_completion_failed'));
      if (alive) { dismiss(id); latest.current.onFinish(); }
    };
    const registered = show({ id, dedupeKey: id, rememberCompleted: false,
      ...(kind === 'info_notice' ? { title, message, durationMs: 6000 }
        : { durationMs: null, render: () => <UpdateToastAction onClose={() => { void close('close'); }} onNavigate={async () => {
          await latest.current.destination.open(campaignId);
          if (alive) await close('destination');
        }} /> }),
      onShow: () => latest.current.onShown(),
      onDismiss: () => { if (alive) latest.current.onFinish(); },
    });
    if (!registered) retry = setTimeout(() => { if (alive) setAttempt(a => a + 1); }, 1000);
    return () => { alive = false; clearTimeout(retry); latest.current.destination.cancel(campaignId); if (registered) dismiss(registered); };
  }, [campaignId, kind, title, message, id, show, dismiss, attempt]);
  return null;
}
