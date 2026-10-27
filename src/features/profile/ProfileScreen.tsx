import { CallNotificationSettings } from '../call-friend/CallNotifications';
import { Smartphone } from 'lucide-react-native';
import { useMemoryQuery } from '../../data/useMemoryQuery';
import { SkeletonRegion } from '../../design/Skeleton';
import { useCallback } from 'react';
import { Platform, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useIdentity } from '../../components/IdentityProvider';
import { Button, InfoIcon } from '../../design/components';
import { colors, spacing, typography } from '../../design/theme';
import { getGoalSettings, getHistory } from '../../data/study';
import { goalText } from '../goals/model';
import { shiftDate, weekStart } from '../records/model';
import { Page, Status, ui } from '../study/StudyUI';
import { useStudy } from '../study/StudyProvider';
import { characterArtwork } from '../../design/character-artwork';
import { SettingsRow, WeeklyAchievement } from './ProfileComponents';
import config from '../../../app.json';

export function ProfileScreen() {
  const { profile } = useIdentity();
  const study = useStudy();
  const today = study.today?.data.day.studyDate;
  const loadSummary = useCallback(async () => {
    const date = study.today?.data.day.studyDate;
    if (!date) throw new Error('Study day is loading');
    const [history, goals] = await Promise.all([getHistory(weekStart(date), date), getGoalSettings()]);
    return { days: history.data, goals: goals.data };
  }, [study.today]);
  const { data: summary, error, retry } = useMemoryQuery(['profile-summary', today], loadSummary);
  const character = profile?.character ?? 'bunny';
  const days = today ? Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(weekStart(today), index);
    const day = date === today ? study.today?.data.day : summary?.days.find(item => item.studyDate === date);
    return !!day?.goalAchieved && !day.isRestDay && day.attendance !== 'leave';
  }) : [];
  const goals = summary?.goals.current;
  const total = goals?.reduce<number>((sum, value) => sum + (value ?? 0), 0) ?? 0;
  return <Page current="profile"><View style={s.content}>
    <Text accessibilityRole="header" style={ui.heading}>{profile?.displayName ?? '나'}님</Text>
    <Status showLoading={false} />
    <Pressable accessibilityRole="button" accessibilityLabel={`${profile?.displayName ?? '내 프로필'}, 이름과 캐릭터 변경`} onPress={() => router.push('/profile-edit')} style={({ pressed }) => [s.profile, pressed && { backgroundColor: colors.surfacePressed }]}>
      <View style={s.avatar}><Image source={characterArtwork[character].focus} resizeMode="contain" style={{ width: 76, height: 84 }} accessibilityLabel={`내 ${characterArtwork[character].label} 캐릭터`} /></View>
      <Text style={[ui.title, { flex: 1 }]}>{profile?.displayName}</Text><Text style={s.edit}>수정 ›</Text>
    </Pressable>
    {!!error && <><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Button label="다시 불러오기" variant="secondary" onPress={() => retry()} /></>}
    <SkeletonRegion loading={!summary} label="이번 주 기록 불러오는 중"><WeeklyAchievement achievedWeekdays={days} /></SkeletonRegion>
    <View style={s.rule} />
    <View style={s.section}><Text style={s.eyebrow}>나의 공부</Text><SettingsRow icon="◎" label="공부 목표 설정" value={goals ? total ? `주 ${goalText(total)}` : goals.every(value => value === 0) ? '모두 쉬는 날' : '목표 미설정' : undefined} onPress={() => router.push('/goals')} />
      {summary?.goals.effectiveDate && <Text style={[ui.muted, { paddingHorizontal: spacing.lg }]}>{summary.goals.effectiveDate} 오전 6시부터 변경 예정인 목표가 있어요.</Text>}
      <SettingsRow icon={<Smartphone size={20} strokeWidth={1.8} color={colors.primary} />} label="허용앱 설정" value={Platform.OS === 'android' ? undefined : 'Android 전용'} onPress={() => router.push('/allowed-apps')} />
    </View>
    <CallNotificationSettings />
    <View style={s.rule} />
    <View style={s.section}><Text style={s.eyebrow}>이용 안내</Text><SettingsRow icon={<InfoIcon tone="primary" />} label="공부와 연차 이용 안내" onPress={() => router.push('/profile-guide')} /><SettingsRow icon="↗" label="앱 정보" value={config.expo.version} onPress={() => router.push('/profile-info')} /></View>
  </View></Page>;
}
const s = StyleSheet.create({
  content: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 32, gap: spacing.lg },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.sm, borderRadius: 12 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.soft, overflow: 'hidden', alignItems: 'center' },
  edit: { ...typography.link, color: colors.secondary },
  rule: { height: 1, backgroundColor: colors.track }, section: { gap: spacing.sm },
  eyebrow: { ...typography.label, color: colors.secondary, paddingTop: spacing.sm },
});
