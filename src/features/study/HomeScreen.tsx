import { ChevronRight } from 'lucide-react-native';
import { characters } from '../profile/CharacterPicker';
import { useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useIdentity } from '../../components/IdentityProvider';
import { AchievementBadge, Button, PressableCard } from '../../design/components';
import { colors, layout, radius, typography } from '../../design/theme';
import { useStudy } from './StudyProvider';
import { Nav, Status } from './StudyUI';
import { displayedSeconds, goalLabel, progress, timer } from './presentation';

const background = require('../../../assets/backgrounds/home-background.png');

export function HomeScreen() {
  const identity = useIdentity();
  const study = useStudy();
  const [scene, setScene] = useState({ width: 390, height: 360 });
  const data = study.today?.data;
  const seconds = data && study.today ? displayedSeconds(data.day, data.activeSession, study.today.serverNow, study.now) : 0;
  const percent = progress(seconds, data?.day.goalMinutes ?? null);
  const running = !!data?.activeSession;
  const activeFriends = study.room?.data.filter(member => member.profile.id !== identity.profile?.id && member.activeSession) ?? [];
  const friendMessage = study.roomError ? '친구 현황을 다시 확인해 주세요' : !study.room ? '친구 현황을 불러오는 중이에요' : activeFriends.length ? `지금 ${activeFriends.length}명이 공부 중이에요` : '오늘의 첫 공부, 먼저 시작해 볼까요?';
  const scale = Math.max(scene.width / 1536, scene.height / 1024);
  const left = (scene.width - 1536 * scale) / 2;
  const top = (scene.height - 1024 * scale) / 2;

  async function toggle() {
    const succeeded = await study.toggle();
    if (succeeded && !running) router.navigate('/focus');
  }

  return <View style={s.outer}><View style={s.page}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} refreshControl={<RefreshControl refreshing={study.loading} onRefresh={() => void study.refresh()} tintColor={colors.primary} />}>
      <Status />
      <View style={s.summary}>
        <Text style={s.label}>오늘 공부한 시간</Text>
        <View style={s.row}><Text numberOfLines={1} adjustsFontSizeToFit style={s.metric}>{data ? timer(seconds) : '—'}</Text>{percent !== null && percent >= 100 && <AchievementBadge label="달성 완료" />}</View>
        <View style={s.row}><View accessibilityRole="progressbar" accessibilityLabel="오늘 목표 달성률" accessibilityValue={percent === null ? { text: '목표 없음' } : { min: 0, max: 100, now: Math.min(percent, 100), text: `${percent}%` }} style={s.track}><View style={[s.fill, { width: `${Math.min(percent ?? 0, 100)}%` }]} /></View><Text style={s.secondary}>{percent === null ? '—' : `${percent}%`}</Text></View>
        <Button label={data ? `${goalLabel(data.day.goalMinutes)}  ›` : '목표 불러오는 중'} variant="ghost" size="compact" onPress={() => router.navigate('/goals')} disabled={!data} style={s.goal} />
      </View>
      <View onLayout={({ nativeEvent }) => setScene({ width: nativeEvent.layout.width, height: nativeEvent.layout.height })} style={s.scene}>
        <Image source={background} resizeMode="contain" style={{ position: 'absolute', left, top, width: 1536 * scale, height: 1024 * scale }} accessibilityLabel="햇살이 드는 공부방" />
        <Image source={characters[identity.profile?.character ?? 'bunny'].image} resizeMode="contain" style={{ position: 'absolute', left: left + (800 - 768 * .72) * scale, top: top + (785 - 860 * .72) * scale - 2, width: 1536 * .72 * scale, height: 1024 * .72 * scale }} accessibilityLabel={`${identity.profile?.displayName ?? '나'}의 ${characters[identity.profile?.character ?? 'bunny'].label} 캐릭터`} />
        <View style={{ flex: 1, minHeight: 284 }} />
        <PressableCard accessibilityLabel={`${friendMessage}, 집중 화면으로 이동`} onPress={() => study.roomError ? void study.refresh() : router.navigate('/focus')} style={s.friends}>
          {!!activeFriends.length && <View style={s.avatars}>{activeFriends.slice(0, 3).map(member => <View key={member.profile.id} style={s.avatar}><Image source={characters[member.profile.character ?? 'bunny'].image} resizeMode="contain" style={{ width: 30, height: 30 }} accessibilityLabel={`${member.profile.displayName} 캐릭터`} /></View>)}</View>}
          <Text style={[s.secondary, { flex: 1, color: colors.text }]}>{friendMessage}</Text><ChevronRight size={20} color={colors.secondary} style={{ flexShrink: 0 }} />
        </PressableCard>
      </View>
      <View style={s.actions}><Button label={study.actionFailed ? '↻  다시 시도' : running ? 'Ⅱ  일시정지' : '▶  공부 시작'} accessibilityLabel={study.actionFailed ? '공부 요청 다시 시도' : running ? '공부 일시정지' : '공부 시작'} loading={study.busy} disabled={!data || !!identity.error} onPress={() => void toggle()} /></View>
    </ScrollView>
    <Nav current="home" />
  </View></View>;
}

const s = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center', backgroundColor: colors.canvas },
  page: { flex: 1, width: '100%', maxWidth: layout.maxWidth, backgroundColor: colors.background },
  summary: { marginHorizontal: 24, minHeight: 268, justifyContent: 'center', paddingTop: 32, paddingBottom: 20, gap: 20 },
  label: { ...typography.body, fontWeight: '600', color: colors.text },
  metric: { ...typography.metric, fontSize: 54, color: colors.text, fontVariant: ['tabular-nums'], flex: 1, minWidth: 0 },
  secondary: { ...typography.secondary, color: colors.secondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goal: { alignSelf: 'flex-start', padding: 0, minHeight: 44 },
  track: { flex: 1, height: 8, backgroundColor: colors.track, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
  scene: { flex: 1, minHeight: 360, paddingBottom: 16, overflow: 'hidden' },
  friends: { marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 14, minHeight: 52, gap: 8, flexDirection: 'row', alignItems: 'center' },
  avatars: { flexDirection: 'row', gap: -10 },
  avatar: { width: 30, height: 30, borderRadius: radius.pill, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  actions: { marginHorizontal: 24, paddingVertical: 16 },
});
