import { withTimeout } from '../../lib/with-timeout';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Dialog, DialogCloseButton } from '../../design/Dialog';
import { Button, Card } from '../../design/components';
import { colors, spacing, typography } from '../../design/theme';
import { useStudy } from '../study/StudyProvider';
import { studyGuard, type GuardApp } from './native';

export function AllowedAppsLauncher({ visible, onClose }: { visible: boolean; onClose(): void }) {
  const study = useStudy();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [apps, setApps] = useState<GuardApp[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  useEffect(() => {
    if (!visible || !studyGuard) return;
    let current = true;
    void Promise.all([withTimeout(studyGuard.status(), 5000, '허용앱 설정 확인 지연'), withTimeout(studyGuard.apps(), 5000, '허용앱 목록 확인 지연')]).then(([status, installed]) => {
      if (current) {
        setNeedsSetup(!status.usageAccess || !status.notificationAccess);
        const allowed = installed.filter(app => status.allowed.includes(app.packageName));
        setApps(allowed);
        setSelected(previous => allowed.some(app => app.packageName === previous) ? previous : allowed.length === 1 ? allowed[0].packageName : null);
        setError('');
      }
    }).catch(() => { if (current) setError('허용앱 목록을 불러오지 못했어요. 설정에서 다시 확인해 주세요.'); });
    return () => { current = false; };
  }, [visible]);
  async function launch(packageName: string) {
    if (!studyGuard || locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await withTimeout(studyGuard.launch(packageName), 5000, '허용앱 실행이 지연되고 있어요. 다시 시도해 주세요.'); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '앱을 실행하지 못했어요.'); }
    finally { locked.current = false; setBusy(false); }
  }
  const settings = () => { onClose(); router.navigate('/allowed-apps'); };
  return <Dialog visible={visible} label="내 허용앱" busy={busy} onClose={onClose}>
    <Card style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}><Text accessibilityRole="header" style={[typography.title, { flex: 1, color: colors.text }]}>내 허용앱</Text><DialogCloseButton label="×" accessibilityLabel="허용앱 목록 닫기" variant="ghost" size="icon" disabled={busy} /></View>
      {!studyGuard ? <><Text style={typography.body}>허용앱 실행은 안드로이드 앱에서 사용할 수 있어요. 웹은 다른 앱으로 이동해도 공부 시간이 계속 누적돼요.</Text><Button label="허용앱 설정하러 가기" variant="secondary" onPress={settings} /></> : <>
        {needsSetup && <><Text style={typography.body}>허용앱을 사용하려면 사용정보 접근과 알림을 허용해 주세요. 기본 타이머는 권한 없이 사용할 수 있어요.</Text><Button label="허용앱 권한 설정" onPress={settings} /></>}
        {!apps && !error && <Text style={typography.body}>허용앱을 불러오고 있어요.</Text>}
        {apps?.length === 0 && <><Text style={typography.body}>아직 등록한 허용앱이 없어요.</Text><Button label="허용앱 설정하러 가기" onPress={settings} /></>}
        {!!apps?.length && <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: spacing.md }}>
          {apps.map(app => <Pressable key={app.packageName} accessibilityRole="radio" accessibilityLabel={`${app.label} 선택`} accessibilityState={{ checked: selected === app.packageName, disabled: busy }} disabled={busy} onPress={() => setSelected(app.packageName)} style={{ padding: spacing.lg, borderRadius: 14, borderWidth: 1, borderColor: selected === app.packageName ? colors.primary : colors.border, backgroundColor: selected === app.packageName ? colors.soft : colors.background }}><Text style={typography.body}>{selected === app.packageName ? '●' : '○'}  {app.label}</Text></Pressable>)}
        </ScrollView>}
        {!!apps?.length && <Button label="선택한 앱으로 이동하기" disabled={needsSetup || busy || study.busy || !selected || !study.today?.data.activeSession} onPress={() => { if (selected) void launch(selected); }} />}
        {!study.today?.data.activeSession && <Text style={[typography.secondary, { color: colors.secondary }]}>공부를 시작한 뒤 허용앱을 실행할 수 있어요.</Text>}
        {!!error && <Text accessibilityRole="alert" style={[typography.secondary, { color: colors.error }]}>{error}</Text>}
        {(!!apps?.length || !!error) && <Button label="허용앱 설정" variant="ghost" disabled={busy} onPress={settings} />}
      </>}
    </Card>
  </Dialog>;
}
