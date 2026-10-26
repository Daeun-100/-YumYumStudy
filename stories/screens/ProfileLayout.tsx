import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, InfoIcon } from '../../src/design/components';
import { colors, spacing, typography } from '../../src/design/theme';
import { SettingsRow, InfoNotice, WeeklyAchievement } from '../../src/features/profile/ProfileComponents';
import { NameEditor } from '../../src/features/profile/NameEditor';
import { GoalsView } from '../../src/features/goals/GoalsView';
import type { GoalWeek } from '../../src/lib/contracts';
import { goalText } from '../../src/features/goals/model';
import { characterArtwork } from '../../src/design/character-artwork';
import type { CharacterId } from '../../src/lib/characters';
import { BottomTabs } from './StudyLayouts';

type Screen = 'name' | 'home' | 'goals' | 'guide' | 'version';
export type ProfileLayoutProps = { character?: CharacterId; initialScreen?: Screen; initialPreview?: boolean; initialDay?: number; width?: number; height?: number; name?: string };
const defaultGoals: GoalWeek = [180, 120, 240, 180, 120, 300, 0];
const guides = [
  ['하루는 오전 6시에 시작해요', '공부 날짜는 한국 시간 오전 6시를 기준으로 바뀌어요. 새벽 공부는 오전 6시 전까지 전날 기록에 포함돼요.'],
  ['시작하고, 잠깐 쉬어가세요', '공부 시작을 누르면 시간이 쌓이고, 일시정지를 누르면 멈춰요. 공부 세션의 시작·종료와 시간은 기록에서 확인할 수 있어요.'],
  ['출석과 목표 달성', '공부한 날은 출석으로 기록해요. 설정한 목표 시간 이상 공부하면 목표 달성이에요. 쉬는 날은 목표 달성률을 표시하지 않아요.'],
  ['연차 획득과 사용', '한 주에 목표를 6일 달성하면 연차를 얻어요. 휴무·연차 사용일은 획득 일수에서 제외돼요. 연차는 미래 공부 날짜에 예약하고, 사용일 오전 6시부터 적용돼요.'],
  ['연차 만료', '연차는 획득 주 시작일로부터 21일 뒤 오전 6시에 만료돼요. 정확한 만료일과 예약 상태는 연차 탭에서 확인해 주세요.'],
  ['기기를 바꾸거나 저장소를 지울 때', '현재 기기의 사용자 정보가 사라지면 기존 기록에 다시 접근하지 못할 수 있어요. 기기 변경이나 앱 데이터 삭제 전에 보관 방법을 확인해 주세요.'],
];
// Local sample state only. The application routes and persistent goals are untouched.
export function ProfileLayout({ character = 'bunny', initialScreen = 'home', initialPreview = false, initialDay, width = 390, height = 844, name = '다이앤' }: ProfileLayoutProps) {
  const [displayName, setDisplayName] = useState(name);
  const seed = () => [...defaultGoals] as GoalWeek;
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [saved, setSaved] = useState<GoalWeek>(seed);
  const [goals, setGoals] = useState<GoalWeek>(seed);
  const [notice, setNotice] = useState('');
  const [discard, setDiscard] = useState(false);
  const dirty = goals.some((value, index) => value !== saved[index]);
  function back() { if (screen === 'goals' && dirty) setDiscard(true); else { setScreen('home'); setNotice(''); } }
  return <View style={[s.phone, { width, height }]}>
    <View style={s.status}><Text style={s.label}>9:41</Text><Text style={s.caption}>● ● ▰</Text></View>
    {screen !== 'goals' && <View style={s.header}>{screen !== 'home' && <Button label="←" size="icon" variant="ghost" accessibilityLabel="나 화면으로 돌아가기" onPress={back} />}<Text accessibilityRole="header" style={s.heading}>{screen === 'home' ? `${displayName}님` : screen === 'name' ? '이름 변경' : screen === 'guide' ? '이용 안내' : '앱 정보'}</Text></View>}
    {screen === 'name' && <NameEditor name={displayName} onCancel={() => setScreen('home')} onSave={value => { setDisplayName(value); setScreen('home'); setNotice('이름을 변경했어요.'); }} />}
    {screen !== 'name' && screen !== 'goals' && <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {screen === 'home' && <>
        <Pressable accessibilityRole="button" accessibilityLabel={`${displayName}, 이름 변경`} onPress={() => { setNotice(''); setScreen('name'); }} style={({ pressed }) => [s.profile, pressed && { backgroundColor: colors.surfacePressed }]} >
          <View style={s.avatar}><Image source={characterArtwork[character].focus} resizeMode="contain" style={{ width: 76, height: 84 }} accessibilityLabel={`내 ${characterArtwork[character].label} 캐릭터`} /></View>
          <View style={{ flex: 1, gap: spacing.xs }}><Text style={s.name}>{displayName}</Text></View><Text style={s.editLabel}>수정 ›</Text>
        </Pressable>
        {notice !== '' && <Text accessibilityLiveRegion="polite" style={[s.caption, { color: colors.primary }]}>{notice}</Text>}
        <WeeklyAchievement achievedDays={4} />
        <View style={s.rule} />
        <View style={s.section}><Text style={s.eyebrow}>나의 공부</Text><SettingsRow icon="◎" label="공부 목표 설정" value={saved.some(v => v !== null && v > 0) ? `주 ${goalText(saved.reduce<number>((sum, v) => sum + (v ?? 0), 0))}` : '모두 쉬는 날'} onPress={() => { setGoals([...saved] as GoalWeek); setScreen('goals'); setNotice(''); }} /></View>
        <View style={s.rule} />
        <View style={s.section}><Text style={s.eyebrow}>이용 안내</Text><SettingsRow icon={<InfoIcon tone="primary" />} label="공부와 연차 이용 안내" onPress={() => setScreen('guide')} /><SettingsRow icon="↗" label="앱 정보" value="1.0.0" onPress={() => setScreen('version')} /></View>
      </>}
      {screen === 'guide' && <><Text style={s.caption}>함께 공부하기 전에 알아두면 좋아요.</Text>{guides.map(([title, body]) => <View key={title} style={s.guideSection}><Text style={s.label}>{title}</Text><Text style={s.body}>{body}</Text></View>)}</>}
      {screen === 'version' && <View style={{ alignItems: 'center', paddingVertical: 40 }}><Text style={s.name}>냠냠스터디</Text><Text style={s.metric}>1.0.0</Text><Text style={s.caption}>설치된 앱 버전</Text><InfoNotice>업데이트 안내가 표시되는 위치예요. 스토리북에서는 실제 업데이트 여부를 확인하지 않아요.</InfoNotice></View>}
    </ScrollView>}
    {screen === 'goals' && <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width, height }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }} style={{ flex: 1 }}><GoalsView embedded goals={goals} saved={saved} initialPreview={initialPreview} initialDay={initialDay} notice={notice} discard={discard}
      onChange={value => { setGoals(value); setNotice(''); }} onSave={() => { setSaved([...goals] as GoalWeek); setNotice('저장했어요. 다음 공부 날짜 오전 6시부터 적용돼요.'); }}
      onRetry={() => {}} onBack={back} onKeepEditing={() => setDiscard(false)} onDiscard={() => { setGoals([...saved] as GoalWeek); setDiscard(false); setScreen('home'); }} /></SafeAreaProvider>}
    {screen === 'home' && <BottomTabs selected="나" onSelect={() => {}} />}

  </View>;
}
const s = StyleSheet.create({
  phone: { maxWidth: '100%', borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  status: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 28, paddingTop: 12, paddingBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, minHeight: 68 },
  heading: { ...typography.heading, color: colors.text, flex: 1 }, title: { ...typography.title, color: colors.text, flex: 1 },
  name: { ...typography.title, color: colors.text },
  metric: { ...typography.heading, color: colors.primary }, label: { ...typography.body, fontWeight: '600', color: colors.text },
  body: { ...typography.body, color: colors.secondary }, caption: { ...typography.secondary, color: colors.secondary },
  content: { paddingHorizontal: spacing.xxl, paddingTop: spacing.lg, gap: spacing.lg, paddingBottom: 32 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.sm, borderRadius: 12 },
  editLabel: { ...typography.link, color: colors.secondary },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.soft, overflow: 'hidden', alignItems: 'center' },
  section: { gap: spacing.sm }, eyebrow: { ...typography.label, color: colors.secondary, paddingTop: spacing.sm },
  group: { gap: spacing.sm },
  rule: { height: 1, backgroundColor: colors.track },
  openSection: { gap: spacing.lg, paddingVertical: spacing.lg },
  guideSection: { gap: spacing.md, paddingVertical: spacing.lg, borderBottomWidth: 1, borderColor: colors.border },
  footer: { padding: spacing.xl, gap: spacing.sm, backgroundColor: colors.background },
  chartRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', minHeight: 32 }, track: { height: 16, flex: 1, backgroundColor: colors.track, borderRadius: 8, overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.canvas, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, paddingBottom: 28, gap: spacing.xl, maxHeight: '92%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  restRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 },
});
