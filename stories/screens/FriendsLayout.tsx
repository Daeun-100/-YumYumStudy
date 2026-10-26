import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AchievementBadge } from '../../src/design/components';
import { colors, radius, spacing, typography } from '../../src/design/theme';
import bunny from '../../assets/characters/bunny/bunny-focus.png';
import bear from '../../assets/characters/bear/bear-focus.png';
import cat from '../../assets/characters/cat/cat-focus.png';
import puppy from '../../assets/characters/puppy/puppy-focus.png';
import { RecordsPreview } from '../../src/features/records/RecordsPreview';
import { timer } from '../../src/features/study/presentation';
import { BottomTabs } from './StudyLayouts';

type Member = { id: string; name: string; active: boolean; minutes: number; goal: number | null; avatar: number; stale?: boolean };
const avatars = [bunny, bear, cat, puppy];
const members: Member[] = [
  { id: '1', name: '민지', active: true, minutes: 81, goal: 180, avatar: 0 },
  { id: '2', name: '수현', active: true, minutes: 132, goal: 120, avatar: 1 },
  { id: '3', name: '지훈', active: false, minutes: 32, goal: 120, avatar: 2 },
  { id: '4', name: '다이앤', active: false, minutes: 0, goal: 0, avatar: 3 },
  { id: '5', name: '유진', active: false, minutes: 45, goal: null, avatar: 0, stale: true },
];
export type FriendsLayoutProps = {
  state?: 'ready' | 'stale' | 'error' | 'loading' | 'empty';
  width?: number;
  height?: number;
  longName?: boolean;
  initialMemberId?: string;
};
const time = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ''}` : `${minutes}분`;
function MemberRow({ member, stale, onPress }: { member: Member; stale: boolean; onPress(): void }) {
  const percent = member.goal && member.goal > 0 ? Math.floor(member.minutes / member.goal * 100) : null;
  const asset = avatars[member.avatar];
  return <Pressable accessibilityRole="button" accessibilityLabel={`${member.name} 공부 기록 보기`} onPress={onPress} style={({ pressed }) => [s.member, pressed && { backgroundColor: colors.surfacePressed }]}>
    <View style={[s.avatar, { backgroundColor: member.active ? colors.soft : colors.emptyBackground }]}>
      <Image source={typeof asset === 'string' ? { uri: asset } : asset} resizeMode="contain" style={s.character} accessibilityLabel={`${member.name} 캐릭터`} />
    </View>
    <View style={s.details}>
      <View style={s.row}><View style={s.identity}><Text style={s.name}>{member.name}</Text><View style={s.status}><View style={[s.dot, { backgroundColor: member.active ? colors.primary : colors.resting }]} /><Text style={s.caption}>{member.active ? '공부 중' : '쉬는 중'}{stale ? ' · 마지막 확인' : ''}</Text></View></View><Text style={s.chevron}>›</Text></View>
      <View style={s.metrics}><View style={s.status}><Text style={s.time}>{timer(Math.round(member.minutes * 60))}</Text>{percent !== null && percent >= 100 && <AchievementBadge compact />}</View><Text style={s.caption}>{member.goal === null ? '목표 미설정' : member.goal === 0 ? '오늘은 휴무' : `목표 ${time(member.goal)}`}</Text></View>
      {percent !== null && <View style={s.row}><View accessibilityRole="progressbar" accessibilityLabel={`${member.name} 오늘 목표 달성률`} accessibilityValue={{ min: 0, max: 100, now: Math.min(percent, 100), text: `${percent}%` }} style={s.track}><View style={[s.fill, { width: `${Math.min(percent, 100)}%` }]} /></View><Text style={[s.percent, percent >= 100 && { color: colors.primary }]}>{percent}%</Text></View>}
    </View>
  </Pressable>;
}
// Storybook-only navigation and sample records; no API or app route side effects.
export function FriendsLayout({ state = 'ready', width = 390, height = 844, longName = false, initialMemberId }: FriendsLayoutProps) {
  const [selectedId, setSelectedId] = useState(initialMemberId);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (state !== 'ready') return;
    const start = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [state]);
  const list = state === 'empty' || state === 'loading' ? [] : members;
  const selected = members.find(member => member.id === selectedId);
  const displayMember = (member: Member) => ({ ...member, minutes: member.minutes + (member.active && !member.stale ? elapsed / 60 : 0), name: longName && member.id === '1' ? '매일 조금씩 성장하는 민지' : member.name });
  return <View style={[s.phone, { width, height }]}>
    <View style={s.statusBar}><Text style={s.percent}>9:41</Text><Text style={s.caption}>● ● ▰</Text></View>
    {selected ? <RecordsPreview key={selected.id} initialDate="2026-10-26" profile={{ id: selected.id, name: displayMember(selected).name, goal: selected.goal, todayMinutes: selected.minutes }} onBack={() => setSelectedId(undefined)} /> : <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.header}><Text accessibilityRole="header" style={s.heading}>친구들</Text></View>
      <View style={s.toolbar}><Text style={s.label}>구성원 {list.length}명</Text>{list.length > 0 && <Text style={s.caption}>공부 중 {list.filter(m => m.active).length}명</Text>}</View>
      {(state === 'stale' || state === 'error') && <Text accessibilityRole="alert" style={s.update}>{state === 'error' ? '연결 끊김' : '갱신 지연'}</Text>}
      {list.map(member => <MemberRow key={member.id} member={displayMember(member)} stale={state === 'stale' || state === 'error' || !!member.stale} onPress={() => setSelectedId(member.id)} />)}
      {state === 'loading' && [0, 1, 2].map(id => <View key={id} accessibilityLabel="친구 정보 불러오는 중" style={s.placeholder}><View style={s.skeleton} /><View style={[s.skeleton, { width: '60%' }]} /></View>)}
      {state === 'empty' && <View style={s.empty}><Text style={s.name}>아직 참여한 친구가 없어요</Text></View>}
    </ScrollView>}
    <BottomTabs selected="친구" onSelect={label => { if (label === '친구') setSelectedId(undefined); }} />
  </View>;
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
