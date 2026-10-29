import { useStudyResources } from '../study/study-resources';
import { recordQueryVersion } from '../../lib/record-query-version';
import { CallNotificationSettings } from '../call-friend/CallNotifications';
import { Smartphone } from 'lucide-react-native';
import { useMemoryQuery } from '../../data/useMemoryQuery';
import { SkeletonRegion } from '../../design/Skeleton';
import { useCallback } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useIdentity } from '../../components/IdentityProvider';
import { Button, InfoIcon } from '../../design/components';
import { colors, spacing, typography } from '../../design/theme';
import { getGoalSettings, getHistory } from '../../data/study';
import { goalText } from '../goals/model';
import { shiftDate, weekStart } from '../records/model';
import { Page, Status, ui } from '../study/StudyUI';
import { useStudy } from '../study/StudyProvider';
import { useScreenNow } from '../study/useScreenNow';
import { displayedSeconds } from '../study/presentation';
import { watermelonGoalPercent } from '../../design/watermelon-fill';
import { ProfileIdentity } from './ProfileIdentity';
import { getMySkins } from '../../data/skins';
import { SettingsRow, WeeklyAchievement } from './ProfileComponents';
import config from '../../../app.json';

export function ProfileScreen() {
  useStudyResources(['today']);
  const { profile } = useIdentity();
  const study = useStudy();
  const now = useScreenNow(!!study.today?.data.activeSession, 60000);
  const today = study.today?.data.day.studyDate;
  const loadSummary = useCallback(async () => {
    const date = study.today?.data.day.studyDate;
    if (!date) throw new Error('Study day is loading');
    const [history, goals] = await Promise.all([getHistory(weekStart(date), date), getGoalSettings()]);
    return { days: history.data, goals: goals.data };
  }, [study.today]);
  const { data: summary, error, retry } = useMemoryQuery(['profile-summary', today], loadSummary, { version: today ? recordQueryVersion(study.today?.data, weekStart(today), today) : '' });
  const { data: collection } = useMemoryQuery(['skins'], getMySkins, { staleTime: 10000 });
  const weekdayProgress = today ? Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(weekStart(today), index);
    const day = date === today ? study.today?.data.day : summary?.days.find(item => item.studyDate === date);
    if (date > today || !day || day.isRestDay || day.attendance === 'leave') return null;
    const snapshot = study.today;
    const seconds = date === today && snapshot ? displayedSeconds(day, snapshot.data.activeSession, snapshot.serverNow, study.error ? Date.parse(snapshot.serverNow) : Math.max(now, Date.parse(snapshot.serverNow))) : day.closedSeconds + day.runningSeconds;
    return watermelonGoalPercent(seconds, day.goalMinutes);
  }) : [];
  const goals = summary?.goals.current;
  const total = goals?.reduce<number>((sum, value) => sum + (value ?? 0), 0) ?? 0;
  return <Page current="profile"><View style={s.content}>
    <Text accessibilityRole="header" style={ui.heading}>{profile?.displayName ?? '나'}님</Text>
    <Status showLoading={false} />
    <ProfileIdentity profile={profile} count={collection?.skins.length} onEdit={() => router.push('/profile-edit')} onSkins={() => router.push('/skins')} />
    <View style={s.rule} />
    {!!error && <><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Button label="다시 불러오기" variant="secondary" onPress={() => retry()} /></>}
    <SkeletonRegion loading={!summary} label="이번 주 기록 불러오는 중"><WeeklyAchievement weekdayProgress={weekdayProgress} /></SkeletonRegion>
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
