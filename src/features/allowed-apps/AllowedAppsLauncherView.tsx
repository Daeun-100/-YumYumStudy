import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '../../design/components';
import { Dialog, DialogCloseButton } from '../../design/Dialog';
import { colors, spacing, typography } from '../../design/theme';
import { AllowedAppIcon } from './AllowedAppIcon';
import type { GuardApp } from './native';

type Props = {
  visible: boolean; embedded?: boolean; nativeAvailable: boolean; needsSetup: boolean;
  apps: GuardApp[] | null; selected: string | null; error: string; busy: boolean;
  studyBusy: boolean; hasSession: boolean;
  onClose(): void; onSettings(): void; onSelect(packageName: string): void; onLaunch(packageName: string): void;
};
export function AllowedAppsLauncherView({ visible, embedded, nativeAvailable, needsSetup, apps, selected, error, busy, studyBusy, hasSession, onClose, onSettings, onSelect, onLaunch }: Props) {
  const selectedApp = apps?.find(app => app.packageName === selected);
  const rows = Array.from({ length: Math.ceil((apps?.length ?? 0) / 3) }, (_, index) => apps!.slice(index * 3, index * 3 + 3));
  return <Dialog visible={visible} embedded={embedded} label="내 허용앱" busy={busy} onClose={onClose}>
    <Card style={{ width: '100%', maxWidth: 300, alignSelf: 'center', gap: spacing.sm, padding: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}><Text accessibilityRole="header" style={[typography.title, { flex: 1, color: colors.text }]}>내 허용앱{apps ? ` · ${apps.length}개` : ''}</Text><DialogCloseButton label="×" accessibilityLabel="허용앱 목록 닫기" variant="ghost" size="icon" disabled={busy} /></View>
      {!nativeAvailable ? <><Text style={typography.body}>허용앱 실행은 안드로이드 앱에서 사용할 수 있어요. 웹은 다른 앱으로 이동해도 공부 시간이 계속 누적돼요.</Text><Button label="허용앱 설정하러 가기" variant="secondary" onPress={onSettings} /></> : <>
        {needsSetup && <><Text style={typography.body}>허용앱을 사용하려면 사용정보 접근과 알림을 허용해 주세요. 기본 타이머는 권한 없이 사용할 수 있어요.</Text><Button label="허용앱 권한 설정" onPress={onSettings} /></>}
        {!apps && !error && <Text style={typography.body}>허용앱을 불러오고 있어요.</Text>}
        {apps?.length === 0 && <><Text style={typography.body}>아직 등록한 허용앱이 없어요.</Text><Button label="허용앱 설정하러 가기" onPress={onSettings} /></>}
        {!!apps?.length && <>
          <ScrollView style={{ maxHeight: 280, flexShrink: 1 }} contentContainerStyle={{ gap: spacing.sm }}>
            {rows.map((row, index) => <View key={index} style={s.row}>
              {row.map(app => <Pressable key={app.packageName} accessibilityRole="radio" accessibilityLabel={`${app.label} 선택`} accessibilityState={{ checked: selected === app.packageName, disabled: busy }} disabled={busy} onPress={() => onSelect(app.packageName)} style={[s.app, selected === app.packageName && s.selected]}>
                <AllowedAppIcon app={app} size={40} />
                <Text numberOfLines={2} style={s.appName}>{app.label}</Text>
                {selected === app.packageName && <Text accessible={false} style={s.check}>✓</Text>}
              </Pressable>)}
              {Array.from({ length: 3 - row.length }, (_, slot) => <View key={`empty-${slot}`} style={{ flex: 1 }} />)}
            </View>)}
          </ScrollView>
          <Button label={selectedApp ? `${selectedApp.label} 열기` : '앱을 선택해 주세요'} disabled={needsSetup || busy || studyBusy || !selectedApp || !hasSession} onPress={() => { if (selectedApp) onLaunch(selectedApp.packageName); }} />
        </>}
        {!hasSession && <Text style={[typography.secondary, { color: colors.secondary }]}>공부를 시작한 뒤 허용앱을 실행할 수 있어요.</Text>}
        {!!error && <Text accessibilityRole="alert" style={[typography.secondary, { color: colors.error }]}>{error}</Text>}
        {(!!apps?.length || !!error) && <Button label="허용앱 설정" variant="ghost" disabled={busy} onPress={onSettings} />}
      </>}
    </Card>
  </Dialog>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  app: { flex: 1, minWidth: 0, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2, paddingVertical: 2, borderWidth: 2, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background },
  selected: { borderColor: colors.primary, backgroundColor: colors.soft },
  appName: { ...typography.caption, lineHeight: 14, textAlign: 'center', color: colors.text, alignSelf: 'stretch' },
  check: { position: 'absolute', top: 2, right: 3, fontSize: 12, color: colors.primary },
});
