import { SkinEffects } from './SkinEffects';
import { resolveCharacterArtwork } from '../../design/skin-artwork';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { resolveBackgroundArtwork } from '../../design/background-artwork';
import { useMeasuredLayout } from '../../hooks/useMeasuredLayout';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AchievementBadge, Button, Card } from '../../design/components';
import { colors, radius, typography } from '../../design/theme';
import type { CharacterId } from '../../lib/characters';
import { AchievementAura } from './AchievementAura';
import { duration, goalLabel, progress, timer } from './presentation';

export type FocusMember = { id: string; name: string; time: string; active: boolean; character: CharacterId; activeSkinId?: string | null; self?: boolean; achieved?: boolean };
export type FocusViewProps = {
  backgroundId?: string;
  effectsEnabled?: boolean;
  effectStrength?: number;
  onWake?(member: FocusMember): void;
  wakeSentIds?: string[];
  timerControl?: ReactNode;
  initialSceneSize?: { width: number; height: number };
  renderRoomOverlay?(size: { width: number; height: number }): ReactNode;
  members: FocusMember[]; memberCount: number | null; seconds: number | null; sessionSeconds?: number | null; goalMinutes: number | null;
  running: boolean; busy?: boolean; disabled?: boolean; retry?: boolean;
  onBack(): void; onFriends(): void; onToggle(): void; onAllowedApps?(): void;
};

/** Shared Storybook and app layout. All session state comes from the caller. */
export function FocusView({ backgroundId, effectsEnabled = true, effectStrength = 1, onWake, wakeSentIds = [], members, memberCount, seconds, sessionSeconds = null, goalMinutes, running, busy, disabled, retry, onBack, onFriends, onToggle, onAllowedApps, renderRoomOverlay, timerControl, initialSceneSize }: FocusViewProps) {
  const [failed, setFailed] = useState<string | undefined>();
  const background = resolveBackgroundArtwork('focus', failed === backgroundId ? undefined : backgroundId);
  const { height } = useWindowDimensions();
  const compact = height < 740;
  const artwork = useMeasuredLayout('focus-art', String(compact));
  const sceneSize = artwork.size ?? initialSceneSize;
  const sceneWidth = sceneSize?.width ?? 0;
  const sceneHeight = sceneSize?.height ?? 0;
  const scale = Math.max(sceneWidth / 1024, sceneHeight / 1100);
  const tableTop = sceneHeight * .78;
  const characterSize = Math.min(115, (sceneWidth - 48) / 4 * 1.25);
  const characterBottom = { bunny: 1154, bear: 1234, cat: 1227, puppy: 1208, maltese: 1100, pomeranian: 1150, blackcat: 1172 };
  const percent = seconds === null ? null : progress(seconds, goalMinutes);
  const achieved = percent !== null && percent >= 100;
  return <>
    <View style={s.header}><Button label="←" size="icon" variant="ghost" accessibilityLabel="홈으로 돌아가기" onPress={onBack} /><Text accessibilityRole="header" style={s.title}>우리 공부방</Text><Button label={onAllowedApps ? '허용앱' : `${memberCount ?? '—'}명`} size="compact" variant="raised" accessibilityLabel={onAllowedApps ? '내 허용앱 목록 열기' : `친구 ${memberCount ?? ''}명 현황 보기`} onPress={onAllowedApps ?? onFriends} /></View>
    <View onLayout={artwork.onLayout} style={s.art}>
      {sceneSize && <>
      <Image fadeDuration={0} source={background.source} onError={() => setFailed(backgroundId)} resizeMode="contain" style={{ position: 'absolute', width: 1024 * scale, height: 1536 * scale, left: (sceneWidth - 1024 * scale) / 2, top: tableTop - 912 * scale }} accessibilityLabel={background.label} />
      <View style={[s.seats, { bottom: sceneHeight - tableTop - 72 * scale }]}>{Array.from({ length: 4 }, (_, index) => {
        const member = members[index];
        const size = characterSize * (member?.character === 'bunny' ? 1.20 : 1);
        const skin = member ? resolveCharacterArtwork(member.character, member.activeSkinId) : undefined;
        const bottom = member ? -size * (1 - (skin?.focusBottom ?? characterBottom[member.character]) / 1254) + (['bunny', 'maltese', 'pomeranian', 'blackcat'].includes(member.character) ? 32 * scale : 0) : 0;
        return <View key={member?.id ?? `empty-${index}`} style={s.seat}>{member && <>
          <Pressable accessibilityRole={onWake && !member.self && !member.active ? "button" : undefined} accessibilityLabel={onWake && !member.self && !member.active ? `${member.name} 부르기${wakeSentIds.includes(member.id) ? ", 부르기 알림 보냄" : ""}` : undefined} disabled={!onWake || member.self || member.active || wakeSentIds.includes(member.id)} onPress={() => onWake?.(member)} style={s.nameTag}><View style={s.tagRow}><View style={[s.dot, { backgroundColor: member.active ? colors.primary : colors.resting }]} /><Text numberOfLines={1} style={s.name}>{member.name}</Text></View><Text numberOfLines={1} style={s.caption}>{member.time}</Text></Pressable>
          <View style={{ width: characterSize, height: characterSize, alignItems: 'center' }}>{(member.achieved ?? (member.self && achieved)) && <View style={{ position: 'absolute', width: size, height: size, bottom }}><AchievementAura character={member.character} size={size} /></View>}<View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, bottom }}><Image fadeDuration={0} source={skin!.focus} resizeMode="contain" style={{ width: size, height: size }} accessibilityLabel={`${member.name}${member.self ? ' (나)' : ''}, ${member.active ? '공부 중' : '쉬는 중'}`} /><SkinEffects effects={skin?.effects} screen="focus" width={size} height={size} enabled={effectsEnabled} strength={effectStrength} phase={index * 650} /></View></View>
        </>}</View>;
      })}</View>
      </>}
      {sceneSize && renderRoomOverlay?.(sceneSize)}
    </View>
    <Card variant="panel" style={[s.panel, compact && { paddingTop: 14, paddingBottom: 14, gap: 6 }]}>
      <View style={s.timerHeading}>
        <Text style={s.secondary}>이번 집중</Text>
        <View pointerEvents="none" accessibilityElementsHidden={!achieved} importantForAccessibility={achieved ? 'auto' : 'no-hide-descendants'} style={[s.achievement, { opacity: achieved ? 1 : 0 }]}><AchievementBadge label="달성 완료" /></View>
      </View>
      <View style={s.timeRow}><Text accessibilityLabel="이번 집중 시간" numberOfLines={1} adjustsFontSizeToFit style={[s.timer, compact && { fontSize: 52, lineHeight: 64 }]}>{seconds === null ? '--:--:--' : timer(sessionSeconds ?? 0)}</Text></View>
      <Text style={s.goalSummary}>{seconds === null ? '오늘 누적 — / 오늘 목표 —' : `오늘 누적 ${duration(seconds, false)} / ${goalLabel(goalMinutes)}`}</Text>
      <View style={s.progressRow}><View accessibilityRole="progressbar" accessibilityLabel="오늘 목표 달성률" accessibilityValue={percent === null ? { text: '목표 없음' } : { min: 0, max: 100, now: Math.min(percent, 100), text: `${percent}%` }} style={s.track}><View style={[s.fill, { width: `${Math.min(percent ?? 0, 100)}%` }]} /></View><Text style={s.secondary}>{percent === null ? '—' : `${percent}%`}</Text></View>
      {timerControl ?? <Button label={retry ? '↻' : running ? 'Ⅱ' : '▶'} size="round" accessibilityLabel={retry ? '공부 요청 다시 시도' : running ? '공부 일시정지' : '공부 시작'} loading={busy} disabled={disabled} onPress={onToggle} style={compact ? { width: 64, height: 64 } : undefined} />}
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
  timerHeading: { width: '100%', minHeight: 40, justifyContent: 'center', alignItems: 'center' },
  achievement: { position: 'absolute', right: 0 },
  timeRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12 },
  timer: { ...typography.timer, color: colors.text, textAlign: 'center', flex: 1, minWidth: 0 },

  goalSummary: { ...typography.caption, color: colors.secondary, textAlign: 'center' },
  progressRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2, marginBottom: 12 },
  track: { flex: 1, height: 8, backgroundColor: colors.track, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
});
