import { ToastProvider, useToast } from '../../src/design/toast';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Info, RefreshCw, Smartphone } from 'lucide-react-native';
import { Button, InfoIcon } from '../../src/design/components';
import { colors, spacing, typography } from '../../src/design/theme';
import { SettingsRow, WeeklyAchievement } from '../../src/features/profile/ProfileComponents';
import { ProfileIdentity } from '../../src/features/profile/ProfileIdentity';
import { BottomTabs } from '../../src/features/navigation/BottomTabs';

export type UpdatePreviewState = 'latest' | 'checking' | 'downloading' | 'ready' | 'studying' | 'saving' | 'applying' | 'error';
export type ProfileUpdatesProps = { initialState?: UpdatePreviewState; sectionOnly?: boolean; width?: number; height?: number };

export function ProfileUpdates(props: ProfileUpdatesProps) {
  const { sectionOnly = false, width = 390, height = 844 } = props;
  return <View style={[sectionOnly ? s.sectionPreview : s.phone, { width }, !sectionOnly && { height }]}>
    <ToastProvider scope="storybook-profile-updates">{sectionOnly
      ? <View style={s.sectionContent}><ProfileUpdatesContent {...props} /></View>
      : <ProfileUpdatesContent {...props} />}</ToastProvider>
  </View>;
}

// Storybook simulation only: no OTA requests, router, study timers or persistent writes.
function ProfileUpdatesContent({ initialState = 'ready', sectionOnly = false }: ProfileUpdatesProps) {
  const [state, setState] = useState(initialState);
  const toast = useToast();
  function notify(message: string) {
    toast.clear();
    toast.show({ message, showIcon: false, tone: 'info', durationMs: 2500 });
  }
  const scheduled = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (scheduled.current) clearTimeout(scheduled.current); }, []);
  function check() {
    setState('checking');
    scheduled.current = setTimeout(() => setState('downloading'), 700);
  }
  useEffect(() => {
    if (state !== 'downloading') return;
    const timer = setTimeout(() => setState('ready'), 2000);
    return () => clearTimeout(timer);
  }, [state]);
  function apply() {
    if (state === 'studying') { notify('공부를 마친 뒤 적용해 주세요.'); return; }
    if (state === 'saving') { notify('저장이 끝난 뒤 다시 눌러 주세요.'); return; }
    setState('applying');
    scheduled.current = setTimeout(() => setState('latest'), 1400);
  }
  const working = ['checking', 'downloading', 'applying'].includes(state);
  const blocked = state === 'studying' || state === 'saving';
  const ready = state === 'ready' || blocked;
  const section = <View style={s.section}>
    <Text style={s.eyebrow}>이용 안내</Text>
    <SettingsRow icon={<InfoIcon tone="primary" />} label="공부와 연차 이용 안내" onPress={() => {}} />
    <View style={s.update}>
      <View style={s.icon} accessible={false}><RefreshCw size={20} color={colors.primary} strokeWidth={1.8} /></View>
      <Text style={[s.label, { flex: 1 }]}>앱 업데이트</Text>
      <View style={s.action}>
        {working ? <View style={s.progress} accessibilityRole="progressbar" accessibilityLabel={state === 'applying' ? '업데이트 적용 중' : '업데이트 준비 중'}><ActivityIndicator size="small" color={colors.primary} /></View>
          : <Pressable accessibilityRole="button" accessibilityLabel={ready ? '적용하기' : '앱 업데이트 다시 확인'} onPress={ready ? apply : check}
            style={({ pressed }) => [s.updateButton, !ready && s.statusButton, ready && { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}>
            <Text numberOfLines={1} style={[s.actionText, !ready && s.statusText, ready && { color: colors.onPrimary }]}>{ready ? '적용하기' : state === 'error' ? '다시 확인' : '최신 상태'}</Text>
          </Pressable>}
      </View>
    </View>
    <SettingsRow icon={<Info size={20} color={colors.primary} strokeWidth={1.8} />} label="앱 정보" value="1.0.2" onPress={() => {}} />
  </View>;
  if (sectionOnly) return section;
  return <>
    <View style={s.statusBar}><Text style={s.time}>9:41</Text><Text style={s.state}>● ● ▰</Text></View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Text accessibilityRole="header" style={s.heading}>다이앤님</Text>
      <ProfileIdentity profile={{ id: 'preview', displayName: '다이앤', character: 'bunny' }} count={3} onEdit={() => {}} onSkins={() => {}} />
      <View style={s.rule} />
      <WeeklyAchievement achievedDays={4} />
      <View style={s.rule} />
      <View style={s.section}><Text style={s.eyebrow}>나의 공부</Text><SettingsRow icon="◎" label="공부 목표 설정" value="주 19시간" onPress={() => {}} /><SettingsRow icon={<Smartphone size={20} color={colors.primary} strokeWidth={1.8} />} label="허용앱 설정" onPress={() => {}} /></View>
      <View style={s.notifications}><Text style={s.label}>친구 부르기 알림</Text><Text style={s.state}>친구가 부르면 메시지를 받아요.</Text><Button label="부르기 알림 끄기" variant="secondary" onPress={() => {}} /></View>
      <View style={s.rule} />
      {section}
    </ScrollView>
    <BottomTabs selected="나" onSelect={() => {}} />
  </>;
}
const s = StyleSheet.create({
  phone: { maxWidth: '100%', borderRadius: 28, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.background },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 28, paddingTop: 12, paddingBottom: 8 },
  time: { ...typography.label, color: colors.text }, heading: { ...typography.heading, color: colors.text },
  content: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 32, gap: spacing.lg },
  sectionPreview: { maxWidth: '100%', backgroundColor: colors.background, borderRadius: 20 },
  sectionContent: { padding: spacing.xxl },
  section: { gap: spacing.sm }, eyebrow: { ...typography.label, color: colors.secondary, paddingTop: spacing.sm },
  rule: { height: 1, backgroundColor: colors.track },
  label: { ...typography.body, fontWeight: '600', color: colors.text }, state: { ...typography.caption, color: colors.secondary },
  notifications: { gap: 10, paddingVertical: 12 },
  update: { height: 76, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 30, alignItems: 'center', justifyContent: 'center' },
  action: { width: 88 },
  updateButton: { minHeight: 44, paddingHorizontal: 10, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  actionText: { ...typography.secondary, fontSize: 14, fontWeight: '600', color: colors.secondary },
  statusButton: { paddingHorizontal: 0, alignItems: 'flex-end' },
  statusText: { ...typography.body, fontWeight: '400', textAlign: 'right' },
  progress: { height: 44, borderRadius: 22, backgroundColor: colors.soft, justifyContent: 'center', alignItems: 'center' },
});
