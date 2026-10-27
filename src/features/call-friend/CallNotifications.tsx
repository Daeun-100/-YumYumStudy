import { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useIdentity } from '../../components/IdentityProvider';
import { Button } from '../../design/components';
import { colors, typography } from '../../design/theme';
import { disablePush, enablePush, listenForCalls, preparePush, pushEnabled, refreshPush } from './push';

export function CallNotificationLifecycle() {
  const { uid } = useIdentity();
  useEffect(() => {
    void preparePush().catch(() => {});
    // Refresh registered destinations only; never prompt on launch or re-enable opted-out devices.
    const refresh = () => { void refreshPush().catch(() => {}); };
    refresh();
    const sub = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const stop = listenForCalls(() => router.navigate('/focus'));
    return () => { stop(); sub.remove(); };
  }, [uid]);
  return null;
}
export function CallNotificationSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { let disposed = false; void pushEnabled().then(value => { if (!disposed) setEnabled(value); }).catch(() => { if (!disposed) setEnabled(false); }); return () => { disposed = true; }; }, []);
  async function toggle() {
    setBusy(true); setError('');
    try { if (enabled) await disablePush(); else await enablePush(); setEnabled(!enabled); }
    catch (e) { setError(e instanceof Error ? e.message : '알림 설정을 확인해 주세요.'); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 10, paddingVertical: 12 }}>
    <Text style={{ ...typography.label, color: colors.text }}>친구 부르기 알림</Text>
    <Text style={{ ...typography.secondary, color: colors.secondary }}>친구가 부르면 메시지를 받아요. iPhone은 홈 화면에 추가한 앱에서 켤 수 있어요.</Text>
    <Button label={enabled ? '부르기 알림 끄기' : '부르기 알림 켜기'} variant="secondary" loading={busy} disabled={enabled === null} onPress={() => void toggle()} />
    {!!error && <Text accessibilityRole="alert" style={{ ...typography.secondary, color: colors.error }}>{error}</Text>}
  </View>;
}
