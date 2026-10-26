import roomBackground from '../../../assets/backgrounds/focus-background.png';
import bunny from '../../../assets/characters/bunny/bunny-focus.png';
import bear from '../../../assets/characters/bear/bear-focus.png';
import cat from '../../../assets/characters/cat/cat-focus.png';
import puppy from '../../../assets/characters/puppy/puppy-focus.png';
import maltese from '../../../assets/characters/maltese/maltese-focus.png';
import pomeranian from '../../../assets/characters/pomeranian/pomeranian-focus.png';
import { useState } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AchievementBadge, Button, Card } from '../../design/components';
import { colors, radius, typography } from '../../design/theme';
import type { CharacterId } from '../../lib/characters';
import { goalLabel, progress, timer } from './presentation';

const imageSource = (asset: number | string) => typeof asset === 'string' ? { uri: asset } : asset;
const characterImages = {
  bunny: imageSource(bunny),
  bear: imageSource(bear),
  cat: imageSource(cat),
  puppy: imageSource(puppy),
  maltese: imageSource(maltese),
  pomeranian: imageSource(pomeranian),
};
export type FocusMember = { id: string; name: string; time: string; active: boolean; character: CharacterId; self?: boolean };
export type FocusViewProps = {
  members: FocusMember[]; memberCount: number | null; seconds: number | null; goalMinutes: number | null;
  running: boolean; busy?: boolean; disabled?: boolean; retry?: boolean;
  onBack(): void; onFriends(): void; onToggle(): void;
};

/** Shared Storybook and app layout. All session state comes from the caller. */
export function FocusView({ members, memberCount, seconds, goalMinutes, running, busy, disabled, retry, onBack, onFriends, onToggle }: FocusViewProps) {
  const [sceneSize, setSceneSize] = useState({ width: 390, height: 400 });
  const { height } = useWindowDimensions();
  const compact = height < 740;
  const scale = Math.max(sceneSize.width / 1024, sceneSize.height / 1100);
  const tableTop = sceneSize.height * .78;
  const characterSize = Math.min(115, (sceneSize.width - 48) / 4 * 1.25);
  const characterBottom = { bunny: 1154, bear: 1234, cat: 1227, puppy: 1208, maltese: 1232, pomeranian: 1218 };
  const percent = seconds === null ? null : progress(seconds, goalMinutes);
  const achieved = percent !== null && percent >= 100;
  return <>
    <View style={s.header}><Button label="←" size="icon" variant="ghost" accessibilityLabel="홈으로 돌아가기" onPress={onBack} /><Text accessibilityRole="header" style={s.title}>우리 공부방</Text><Button label={`${memberCount ?? '—'}명`} size="compact" variant="raised" accessibilityLabel={`친구 ${memberCount ?? ''}명 현황 보기`} onPress={onFriends} /></View>
    <View onLayout={({ nativeEvent }) => setSceneSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height })} style={s.art}>
      <Image source={imageSource(roomBackground)} resizeMode="contain" style={{ position: 'absolute', width: 1024 * scale, height: 1536 * scale, left: (sceneSize.width - 1024 * scale) / 2, top: tableTop - 912 * scale }} accessibilityLabel="함께 공부하는 공부방" />
      <View style={[s.seats, { bottom: sceneSize.height - tableTop - 72 * scale }]}>{Array.from({ length: 4 }, (_, index) => {
        const member = members[index];
        const size = characterSize * (member?.character === 'bunny' ? 1.20 : 1);
        return <View key={member?.id ?? `empty-${index}`} style={s.seat}>{member && <>
          <View style={s.nameTag}><View style={s.tagRow}><View style={[s.dot, { backgroundColor: member.active ? colors.primary : colors.resting }]} /><Text numberOfLines={1} style={s.name}>{member.name}</Text></View><Text numberOfLines={1} style={s.caption}>{member.time}</Text></View>
          <View style={{ width: characterSize, height: characterSize, alignItems: 'center' }}><Image source={characterImages[member.character]} resizeMode="contain" style={{ position: 'absolute', width: size, height: size, bottom: -size * (1 - characterBottom[member.character] / 1254) + (member.character === 'bunny' ? 32 * scale : 0) }} accessibilityLabel={`${member.name}${member.self ? ' (나)' : ''}, ${member.active ? '공부 중' : '쉬는 중'}`} /></View>
        </>}</View>;
      })}</View>
    </View>
    <Card variant="panel" style={[s.panel, compact && { paddingTop: 14, paddingBottom: 14, gap: 6 }]}>
      <Text style={s.secondary}>오늘 공부한 시간</Text>
      <View style={s.timeRow}><Text numberOfLines={1} adjustsFontSizeToFit style={[s.timer, compact && { fontSize: 44, lineHeight: 54 }]}>{seconds === null ? '--:--:--' : timer(seconds)}</Text>{achieved && <View style={{ flexShrink: 0 }}><AchievementBadge label="달성 완료" /></View>}</View>
      <View style={s.goalRow}><Text style={[s.secondary, { textAlign: 'center' }]}>{seconds === null ? '기록을 확인하고 있어요' : goalLabel(goalMinutes)}{seconds !== null && goalMinutes !== null && goalMinutes > 0 && !achieved ? ` · ${timer(Math.max(0, goalMinutes * 60 - seconds))} 남았어요` : ''}</Text></View>
      <View style={s.progressRow}><View accessibilityRole="progressbar" accessibilityLabel="오늘 목표 달성률" accessibilityValue={percent === null ? { text: '목표 없음' } : { min: 0, max: 100, now: Math.min(percent, 100), text: `${percent}%` }} style={s.track}><View style={[s.fill, { width: `${Math.min(percent ?? 0, 100)}%` }]} /></View><Text style={s.secondary}>{percent === null ? '—' : `${percent}%`}</Text></View>
      <Button label={retry ? '↻' : running ? 'Ⅱ' : '▶'} size="round" accessibilityLabel={retry ? '공부 요청 다시 시도' : running ? '공부 일시정지' : '공부 시작'} loading={busy} disabled={disabled} onPress={onToggle} style={compact ? { width: 64, height: 64 } : undefined} />
    </Card>
  </>;
}
const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.title, color: colors.text }, secondary: { ...typography.secondary, color: colors.secondary }, caption: { ...typography.caption, color: colors.secondary },
  art: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: colors.emptyBackground, alignItems: 'center', justifyContent: 'flex-end' },
  seats: { position: 'absolute', flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, width: '100%' },
  seat: { flex: 1, minWidth: 0, alignItems: 'center', gap: 12 },
  nameTag: { width: '100%', padding: 8, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', gap: 2 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 4 }, name: { ...typography.label, color: colors.text, flexShrink: 1 },
  dot: { width: 9, height: 9, borderRadius: radius.pill }, character: { width: '125%', height: 115 },
  panel: { marginTop: -28, alignItems: 'center', gap: 10, paddingTop: 22, paddingBottom: 24 },
  timeRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12 },
  timer: { ...typography.timer, color: colors.text, textAlign: 'center', flex: 1, minWidth: 0 },
  goalRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 },
  progressRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2, marginBottom: 12 },
  track: { flex: 1, height: 8, backgroundColor: colors.track, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
});
