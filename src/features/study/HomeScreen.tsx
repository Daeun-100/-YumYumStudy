import { useScreenNow } from './useScreenNow';
import { useState } from 'react';
import { AllowedAppsLauncher } from '../allowed-apps/AllowedAppsLauncher';
import { resolveCharacterArtwork } from '../../design/skin-artwork';
import { useMeasuredLayout } from '../../hooks/useMeasuredLayout';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useIsFocused } from 'expo-router';
import { useIdentity } from '../../components/IdentityProvider';
import { AchievementBadge, Button } from '../../design/components';
import { colors, layout, radius, typography } from '../../design/theme';
import { useStudy } from './StudyProvider';
import { StudyControl } from './StudyControl';
import { displayedSeconds, goalLabel, progress, timer } from './presentation';

import { HomeArtwork } from './HomeArtwork';

export function HomeScreen() {
  const focused = useIsFocused();
  const [allowedAppsOpen, setAllowedAppsOpen] = useState(false);
  const identity = useIdentity();
  const study = useStudy();
  const studyNow = useScreenNow();
  const frame = useMeasuredLayout('home-frame');
  const height = frame.size?.height ?? null;
  const compact = height !== null && height < 620;
  const artwork = useMeasuredLayout('home-art', String(compact));
  const scene = artwork.size;
  const data = study.today?.data;
  const seconds = data && study.today ? displayedSeconds(data.day, data.activeSession, study.today.serverNow, studyNow) : 0;
  const todayLeave = data?.day.attendance === 'leave';
  const percent = progress(seconds, data?.day.goalMinutes ?? null);
  const activeFriends = study.room?.data.filter(member => member.profile.id !== identity.profile?.id && member.activeSession) ?? [];
  const friendMessage = `지금 ${activeFriends.length}명이 공부 중이에요`;

  return <View style={s.outer}><View style={s.page}>
    <View style={{ flex: 1, minHeight: 0 }} onLayout={frame.onLayout}>
      <View style={[s.summary, compact && s.summaryCompact]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={s.label}>오늘 전체 공부 시간</Text><Button label="허용앱" accessibilityLabel="내 허용앱 목록 열기" size="compact" variant="raised" onPress={() => setAllowedAppsOpen(true)} /></View>
        <View style={s.timerGroup}>
        <View style={s.timerRow}><StudyControl round roundSize={56} onStarted={() => router.navigate('/focus')} /><Text numberOfLines={1} adjustsFontSizeToFit style={[s.metric, compact && { fontSize: 40 }]}>{data ? timer(seconds) : '—'}</Text></View>
        <View style={s.row}><View accessibilityRole="progressbar" accessibilityLabel={todayLeave ? '연차일의 기존 목표 대비 공부량' : '오늘 목표 달성률'} accessibilityValue={percent === null ? { text: '목표 없음' } : { min: 0, max: 100, now: Math.min(percent, 100), text: `${percent}%` }} style={[s.track, todayLeave && { backgroundColor: colors.leaveTrack }]}><View style={[s.fill, { width: `${Math.min(percent ?? 0, 100)}%` }]} /></View><Text style={s.secondary}>{percent === null ? '—' : `${percent}%`}</Text></View>
        </View>
        <View style={s.goalRow}>{todayLeave ? <Pressable accessibilityRole="button" accessibilityLabel="연차 탭으로 이동" onPress={() => router.navigate('/leave')} style={({ pressed }) => [s.goal, { minHeight: 44, justifyContent: 'center', borderRadius: 12 }, pressed && { backgroundColor: colors.surfacePressed }]}><Text style={[s.secondary, { color: colors.leave }]}>✈  오늘 연차  ›</Text></Pressable> : <Button label={data ? `${goalLabel(data.day.goalMinutes)}  ›` : '오늘 목표 —'} variant="ghost" size="compact" onPress={() => router.navigate({ pathname: '/goals', params: { view: 'preview' } })} disabled={!data} style={s.goal} />}{percent !== null && percent >= 100 && <AchievementBadge label="달성 완료" />}</View>
      </View>
      <View onLayout={artwork.onLayout} style={s.scene}>
        {height !== null && scene && <HomeArtwork effectsEnabled={focused} activeSkinId={identity.profile?.activeSkinId} character={identity.profile?.character ?? 'bunny'} width={scene.width} height={scene.height} />}
        {!!activeFriends.length && !study.roomError && <View accessibilityLabel={friendMessage} style={s.friends}>
          {!!activeFriends.length && <View style={s.avatars}>{activeFriends.slice(0, 3).map(member => <View key={member.profile.id} style={s.avatar}><Image fadeDuration={0} source={resolveCharacterArtwork(member.profile.character, member.profile.activeSkinId).home} resizeMode="contain" style={{ width: 30, height: 30 }} accessibilityLabel={`${member.profile.displayName} 캐릭터`} /></View>)}</View>}
          <Text style={[s.secondary, { flex: 1, color: colors.text }]}>{friendMessage}</Text>
        </View>}
      </View>
      <View style={s.actions}><Button label="공부방 입장하기" onPress={() => router.navigate('/focus')} style={{ minHeight: 60 }} /></View>
    </View>
    <AllowedAppsLauncher visible={allowedAppsOpen} onClose={() => setAllowedAppsOpen(false)} />
  </View></View>;
}

const s = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center', backgroundColor: colors.canvas },
  page: { flex: 1, width: '100%', maxWidth: layout.maxWidth, backgroundColor: colors.background },
  summaryCompact: { minHeight: 200, paddingTop: 12, paddingBottom: 8, gap: 8 },
  summary: { marginHorizontal: 24, minHeight: 268, justifyContent: 'center', paddingTop: 32, paddingBottom: 20, gap: 20 },
  label: { ...typography.body, fontWeight: '600', color: colors.text },
  metric: { ...typography.metric, fontSize: 44, color: colors.text, fontVariant: ['tabular-nums'], flex: 1, flexShrink: 1, minWidth: 0 },
  secondary: { ...typography.secondary, color: colors.secondary },
  timerGroup: { gap: 12 },
  goalRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goal: { alignSelf: 'flex-start', padding: 0, minHeight: 44 },
  track: { flex: 1, height: 8, backgroundColor: colors.track, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
  scene: { flex: 1, minHeight: 84, overflow: 'hidden' },
  friends: { position: 'absolute', top: 16, left: 16, right: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surface, boxShadow: '0 4px 16px rgba(37, 45, 40, 0.14)', gap: 10, flexDirection: 'row', alignItems: 'center' },
  avatars: { flexDirection: 'row', gap: -10 },
  avatar: { width: 30, height: 30, borderRadius: radius.pill, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  actions: { marginHorizontal: 24, paddingVertical: 16 },
});
