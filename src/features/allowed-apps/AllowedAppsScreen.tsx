import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAndroidBack } from '../navigation/useAndroidBack';
import { AllowedAppsView } from './AllowedAppsView';
import { AllowedAppsSetup } from './AllowedAppsSetup';
import { studyGuard, type GuardApp, type GuardStatus } from './native';

const back = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };
export default function AllowedAppsScreen() {
  useAndroidBack(() => { back(); return true; });
  const [status, setStatus] = useState<GuardStatus | null>(null);
  const [apps, setApps] = useState<GuardApp[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const alive = useRef(true);
  const refresh = useCallback(async () => {
    if (!studyGuard || AppState.currentState !== 'active') return;
    try { const next = await studyGuard.status(); if (alive.current) setStatus(next); }
    catch (failure) { if (alive.current) setError(String(failure)); }
  }, []);
  useEffect(() => {
    alive.current = true;
    const initial = setTimeout(() => void refresh(), 0);
    void studyGuard?.apps().then(value => { if (alive.current) setApps(value); }).catch(failure => { if (alive.current) setError(String(failure)); });
    const timer = setInterval(() => void refresh(), 500);
    const listener = AppState.addEventListener('change', () => void refresh());
    return () => { alive.current = false; clearTimeout(initial); clearInterval(timer); listener.remove(); };
  }, [refresh]);
  async function action(run: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await run(); await refresh(); }
    catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  async function enableNotifications() {
    if (!studyGuard) return;
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) { await studyGuard.openNotificationSettings(); return; }
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('알림이 허용되지 않았어요. 다시 시도하거나 아래 알림 설정 열기에서 직접 허용해 주세요.');
    }
    const next = await studyGuard.status();
    if (!next.notificationAccess) await studyGuard.openNotificationSettings();
  }
  return <AllowedAppsView nativeAvailable={!!studyGuard} status={status} apps={apps}
    setupContent={studyGuard && <AllowedAppsSetup status={status} busy={busy} guard={studyGuard} run={action} onEnableNotifications={enableNotifications} />}
    error={error} busy={busy} search={search} onSearch={setSearch} onBack={back}
    onSelect={(pkg, value) => void action(() => studyGuard!.select(value ? [...(status?.allowed ?? []), pkg] : (status?.allowed ?? []).filter(item => item !== pkg)))} />;
}
