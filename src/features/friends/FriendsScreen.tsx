import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AchievementBadge, Button } from '../../design/components';
import { colors, radius, spacing, typography } from '../../design/theme';
import { Page, ui } from '../study/StudyUI';
import { useStudy } from '../study/StudyProvider';
import { displayedSeconds, duration, progress, timer } from '../study/presentation';
import { FriendRecords } from './FriendRecords';

const focusImages = {
  bunny: require('../../../assets/characters/bunny/bunny-focus.png'),
  bear: require('../../../assets/characters/bear/bear-focus.png'),
  cat: require('../../../assets/characters/cat/cat-focus.png'),
  puppy: require('../../../assets/characters/puppy/puppy-focus.png'),
  maltese: require('../../../assets/characters/maltese/maltese-focus.png'),
  pomeranian: require('../../../assets/characters/pomeranian/pomeranian-focus.png'),
  blackcat: require('../../../assets/characters/black-cat/black-cat-focus.png'),
};

export function FriendsScreen() {
  const study = useStudy();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const members = study.room?.data ?? [];
  const selected = members.find(member => member.profile.id === selectedId);
  if (selected) return <FriendRecords key={selected.profile.id} member={selected} onBack={() => setSelectedId(null)} />;
  const stale = !!study.roomError || !!study.room && study.now - Date.parse(study.room.serverNow) > 90000;
  return <Page current="friends"><View style={s.content}>
    <View style={s.header}><Text accessibilityRole="header" style={s.heading}>친구들</Text></View>
    <View style={s.toolbar}><Text style={s.label}>구성원 {members.length}명</Text>{study.room && <Text style={s.caption}>공부 중 {members.filter(member => member.activeSession).length}명</Text>}</View>
    {stale && <Text accessibilityRole="alert" style={s.update}>{study.roomError ? '연결 끊김 · 마지막 확인한 현황이에요' : '갱신 지연 · 마지막 확인한 현황이에요'}</Text>}
    {study.roomError && <View style={{ gap: spacing.sm, paddingVertical: spacing.md }}><Text accessibilityRole="alert" style={ui.error}>{study.roomError}</Text><Button variant="secondary" size="compact" label="다시 불러오기" disabled={study.loading} onPress={() => void study.refresh()} /></View>}
    {!study.room && !study.roomError && [0, 1, 2].map(id => <View key={id} accessibilityLabel="친구 정보 불러오는 중" style={s.placeholder}><View style={s.skeleton} /><View style={[s.skeleton, { width: '60%' }]} /></View>)}
    {members.map(member => {
      const seconds = displayedSeconds(member.today, member.activeSession, study.room!.serverNow, stale ? Date.parse(study.room!.serverNow) : Math.max(study.now, Date.parse(study.room!.serverNow)));
      const percent = progress(seconds, member.today.goalMinutes);
      const goal = member.today.goalMinutes;
      return <Pressable key={member.profile.id} accessibilityRole="button" accessibilityLabel={`${member.profile.displayName} 공부 기록 보기`} onPress={() => setSelectedId(member.profile.id)} style={({ pressed }) => [s.member, pressed && { backgroundColor: colors.surfacePressed }]}>
        <View style={[s.avatar, { backgroundColor: member.activeSession ? colors.soft : colors.emptyBackground }]}><Image source={focusImages[member.profile.character ?? 'bunny']} resizeMode="contain" style={s.character} accessibilityLabel={`${member.profile.displayName} 집중 캐릭터`} /></View>
        <View style={s.details}><View style={s.row}><View style={s.identity}><Text style={s.name}>{member.profile.displayName}</Text><View style={s.status}><View style={[s.dot, { backgroundColor: member.activeSession ? colors.primary : colors.resting }]} /><Text style={s.caption}>{member.activeSession ? '공부 중' : '쉬는 중'}{stale ? ' · 마지막 확인' : ''}</Text></View></View><Text style={s.chevron}>›</Text></View>
        <View style={s.metrics}><View style={s.status}><Text style={s.time}>{timer(seconds)}</Text>{percent !== null && percent >= 100 && <AchievementBadge compact />}</View><Text style={s.caption}>{goal === null ? '목표 미설정' : goal === 0 ? '오늘은 휴무' : `목표 ${duration(goal * 60, false)}`}</Text></View>
        {percent !== null && <View style={s.row}><View accessibilityRole="progressbar" accessibilityLabel={`${member.profile.displayName} 오늘 목표 달성률`} accessibilityValue={{ min: 0, max: 100, now: Math.min(percent, 100), text: `${percent}%` }} style={s.track}><View style={[s.fill, { width: `${Math.min(percent, 100)}%` }]} /></View><Text style={[s.percent, percent >= 100 && { color: colors.primary }]}>{percent}%</Text></View>}
        </View>
      </Pressable>;
    })}
    {study.room && !members.length && <View style={s.empty}><Text style={s.name}>아직 참여한 친구가 없어요</Text></View>}
  </View></Page>;
}

const s = StyleSheet.create({
  phone: { maxWidth: '100%', borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  statusBar: { height: 44, paddingHorizontal: spacing.xxxl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  content: { paddingHorizontal: spacing.xxl, gap: 0, paddingBottom: spacing.xxl },
  header: { minHeight: 68, justifyContent: 'center', gap: spacing.xs },
  heading: { ...typography.heading, color: colors.text }, body: { ...typography.secondary, color: colors.secondary },
  summary: { backgroundColor: colors.soft, gap: spacing.xs, padding: spacing.xl },
  summaryTitle: { ...typography.body, fontWeight: '600', color: colors.primary, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, status: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.primary },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.track },
  label: { ...typography.link, color: colors.text }, caption: { ...typography.caption, color: colors.secondary },
  member: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.xl, borderBottomWidth: 1, borderColor: colors.track }, details: { flex: 1, gap: spacing.sm }, chevron: { ...typography.backIcon, color: colors.secondary }, avatar: { width: 44, height: 44, borderRadius: radius.pill, overflow: 'hidden' }, character: { width: 44, height: 44 },
  identity: { flex: 1, gap: spacing.xs }, name: { ...typography.body, fontWeight: '700', color: colors.text },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.xs },
  time: { ...typography.body, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  track: { flex: 1, height: 5, borderRadius: radius.pill, backgroundColor: colors.track, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
  percent: { ...typography.label, color: colors.secondary, fontVariant: ['tabular-nums'] }, update: { ...typography.small, color: colors.secondary },
  empty: { alignItems: 'center', paddingVertical: 40 }, placeholder: { minHeight: 112, gap: spacing.md, borderBottomWidth: 1, borderColor: colors.track, justifyContent: 'center' }, skeleton: { height: 16, width: '85%', borderRadius: radius.pill, backgroundColor: colors.track },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: 12, minHeight: 44 }, selectedDay: { backgroundColor: colors.soft },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, calendar: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm }, calendarLabel: { width: '14.285714%', textAlign: 'center' }, calendarCell: { width: '14.285714%', minHeight: 55, alignItems: 'center' },
  notice: { ...typography.caption, color: colors.leave, backgroundColor: colors.leaveBackground, padding: spacing.md, borderRadius: spacing.md }, footer: { textAlign: 'center', marginTop: spacing.md },
});
