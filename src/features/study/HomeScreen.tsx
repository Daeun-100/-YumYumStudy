import { useState } from 'react';
import { AllowedAppsLauncher } from '../allowed-apps/AllowedAppsLauncher';
import { ChevronRight } from 'lucide-react-native';
import { characters } from '../profile/CharacterPicker';
import { useMeasuredLayout } from '../../hooks/useMeasuredLayout';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useIdentity } from '../../components/IdentityProvider';
import { AchievementBadge, Button, PressableCard } from '../../design/components';
import { colors, layout, radius, typography } from '../../design/theme';
import { useStudy } from './StudyProvider';
import { Nav } from './StudyUI';
import { StudyControl } from './StudyControl';
import { displayedSeconds, goalLabel, progress, timer } from './presentation';

import { HomeArtwork } from './HomeArtwork';

export function HomeScreen() {
  const [allowedAppsOpen, setAllowedAppsOpen] = useState(false);
  const identity = useIdentity();
  const study = useStudy();
  const frame = useMeasuredLayout('home-frame');
  const height = frame.size?.height ?? null;
  const compact = height !== null && height < 620;
  const artwork = useMeasuredLayout('home-art', String(compact));
  const scene = artwork.size;
  const data = study.today?.data;
  const seconds = data && study.today ? displayedSeconds(data.day, data.activeSession, study.today.serverNow, study.now) : 0;
  const percent = progress(seconds, data?.day.goalMinutes ?? null);
  const activeFriends = study.room?.data.filter(member => member.profile.id !== identity.profile?.id && member.activeSession) ?? [];
  const friendMessage = !study.room ? '함께 공부하는 친구들' : activeFriends.length ? `지금 ${activeFriends.length}명이 공부 중이에요` : '오늘의 첫 공부, 먼저 시작해 볼까요?';

  return <View style={s.outer}><View style={s.page}>
    <View style={{ flex: 1, minHeight: 0 }} onLayout={frame.onLayout}>
      <View style={[s.summary, compact && s.summaryCompact]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={s.label}>오늘 전체 공부 시간</Text><Button label="허용앱" accessibilityLabel="내 허용앱 목록 열기" size="compact" variant="raised" onPress={() => setAllowedAppsOpen(true)} /></View>
        <View style={s.timerGroup}>
        <View style={s.timerRow}><Text numberOfLines={1} adjustsFontSizeToFit style={[s.metric, compact && { fontSize: 44 }]}>{data ? timer(seconds) : '—'}</Text>{percent !== null && percent >= 100 && <View style={s.timerBadge}><AchievementBadge label="달성 완료" /></View>}</View>
        <View style={s.row}><View accessibilityRole="progressbar" accessibilityLabel="오늘 목표 달성률" accessibilityValue={percent === null ? { text: '목표 없음' } : { min: 0, max: 100, now: Math.min(percent, 100), text: `${percent}%` }} style={s.track}><View style={[s.fill, { width: `${Math.min(percent ?? 0, 100)}%` }]} /></View><Text style={s.secondary}>{percent === null ? '—' : `${percent}%`}</Text></View>
        </View>
        <Button label={data ? `${goalLabel(data.day.goalMinutes)}  ›` : '오늘 목표 —'} variant="ghost" size="compact" onPress={() => router.navigate('/goals')} disabled={!data} style={s.goal} />
      </View>
      <View onLayout={artwork.onLayout} style={s.scene}>
        {height !== null && scene && <HomeArtwork character={identity.profile?.character ?? 'bunny'} width={scene.width} height={scene.height} />}
        <View style={{ flex: 1, minHeight: 0 }} />
        <PressableCard accessibilityLabel={`${friendMessage}, 집중 화면으로 이동`} onPress={() => router.navigate('/focus')} style={s.friends}>
          {!!activeFriends.length && <View style={s.avatars}>{activeFriends.slice(0, 3).map(member => <View key={member.profile.id} style={s.avatar}><Image source={characters[member.profile.character ?? 'bunny'].image} resizeMode="contain" style={{ width: 30, height: 30 }} accessibilityLabel={`${member.profile.displayName} 캐릭터`} /></View>)}</View>}
          <Text style={[s.secondary, { flex: 1, color: colors.text }]}>{friendMessage}</Text><ChevronRight size={20} color={colors.secondary} style={{ flexShrink: 0 }} />
        </PressableCard>
      </View>
      <View style={s.actions}><StudyControl onStarted={() => router.navigate('/focus')} /></View>
    </View>
    <AllowedAppsLauncher visible={allowedAppsOpen} onClose={() => setAllowedAppsOpen(false)} />
    <Nav current="home" />
  </View></View>;
}

const s = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center', backgroundColor: colors.canvas },
  page: { flex: 1, width: '100%', maxWidth: layout.maxWidth, backgroundColor: colors.background },
  summaryCompact: { minHeight: 200, paddingTop: 12, paddingBottom: 8, gap: 8 },
  summary: { marginHorizontal: 24, minHeight: 268, justifyContent: 'center', paddingTop: 32, paddingBottom: 20, gap: 20 },
  label: { ...typography.body, fontWeight: '600', color: colors.text },
  metric: { ...typography.metric, fontSize: 54, color: colors.text, fontVariant: ['tabular-nums'], flexShrink: 1, minWidth: 0 },
  secondary: { ...typography.secondary, color: colors.secondary },
  timerGroup: { gap: 12 },
  timerBadge: { alignSelf: 'flex-end', marginBottom: 6 },
  timerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goal: { alignSelf: 'flex-start', padding: 0, minHeight: 44 },
  track: { flex: 1, height: 8, backgroundColor: colors.track, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
  scene: { flex: 1, minHeight: 84, paddingBottom: 16, overflow: 'hidden' },
  friends: { marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 14, minHeight: 52, gap: 8, flexDirection: 'row', alignItems: 'center' },
  avatars: { flexDirection: 'row', gap: -10 },
  avatar: { width: 30, height: 30, borderRadius: radius.pill, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  actions: { marginHorizontal: 24, paddingVertical: 16 },
});
