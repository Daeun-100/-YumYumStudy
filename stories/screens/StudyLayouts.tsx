import { Dialog, DialogCloseButton } from '../../src/design/Dialog';
import { BottomTabs } from '../../src/features/navigation/BottomTabs';
import { StudyControlView } from '../../src/features/study/StudyControlView';
import { HomeArtwork } from '../../src/features/study/HomeArtwork';
import { FocusView } from '../../src/features/study/FocusView';
import { ChevronRight } from 'lucide-react-native';
import homeBackground from '../../assets/backgrounds/home-background.png';
import homeBunny from '../../assets/characters/bunny/bunny-home.png';
import bunny from '../../assets/characters/bunny/bunny-focus.png';
import bear from '../../assets/characters/bear/bear-focus.png';
import cat from '../../assets/characters/cat/cat-focus.png';
import puppy from '../../assets/characters/puppy/puppy-focus.png';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AchievementBadge, Button, PressableCard } from '../../src/design/components';
import { colors, interaction, radius, typography } from '../../src/design/theme';
import type { CharacterId } from '../../src/lib/characters';
const imageSource = (asset: number | string) => typeof asset === 'string' ? { uri: asset } : asset;
const characters = [bunny, bear, cat, puppy];

export type LayoutProps = {
  character?: CharacterId;
  activeSkinId?: string;
  screen: 'home' | 'focus';
  homeEntryPreview?: boolean;
  todayLeave?: boolean;
  onOpenLeave?(): void;
  running?: boolean;
  seconds?: number;
  goalMinutes?: number;
  activeFriendCount?: number;
  name?: string;
  width?: number;
  height?: number;
  sceneMinHeight?: number;
  renderHomeOverlay?(scene: { width: number; height: number }): ReactNode;
  renderFocusOverlay?(scene: { width: number; height: number }): ReactNode;
};
const friends = [
  { name: '민지', time: '53분', active: true },
  { name: '수현', time: '2시간', active: true },
  { name: '지훈', time: '32분', active: false },
];
function clock(seconds: number) {
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
}
function Progress({ seconds, goalMinutes, todayLeave = false }: { seconds: number; goalMinutes: number; todayLeave?: boolean }) {
  const percent = goalMinutes > 0 ? Math.floor(seconds / (goalMinutes * 60) * 100) : null;
  return <View style={s.progressRow}><View accessibilityRole="progressbar" accessibilityLabel="목표 달성률" accessibilityValue={percent === null ? { text: '목표 없음' } : { min: 0, max: 100, now: Math.min(percent, 100), text: `${percent}%` }} style={[s.track, todayLeave && { backgroundColor: colors.leaveTrack }]}><View style={[s.fill, { width: `${Math.min(percent ?? 0, 100)}%` }]} /></View><Text style={s.secondary}>{percent === null ? '—' : `${percent}%`}</Text></View>;
}
// Storybook-only presentation: no identity, API, router, or running study session.
export function StudyLayout({ screen, character = 'bunny', activeSkinId, homeEntryPreview = false, todayLeave = false, onOpenLeave, running = true, seconds: initialSeconds = 4815, goalMinutes = 180, activeFriendCount = 2, name = '다이앤', width = 390, height = 844, sceneMinHeight, renderHomeOverlay, renderFocusOverlay }: LayoutProps) {
  const [activeScreen, setActiveScreen] = useState(screen);
  const [isRunning, setRunning] = useState(running);
  const [seconds, setSeconds] = useState(initialSeconds);
  useEffect(() => { const timer = setTimeout(() => setSeconds(initialSeconds), 0); return () => clearTimeout(timer); }, [initialSeconds]);
  useEffect(() => {
    if (!isRunning) return;
    let last = Date.now();
    const interval = setInterval(() => {
      const added = Math.floor((Date.now() - last) / 1000);
      if (added > 0) { last += added * 1000; setSeconds(value => value + added); }
    }, 250);
    return () => clearInterval(interval);
  }, [isRunning]);
  const [notice, setNotice] = useState('');
  const [leaveDetails, setLeaveDetails] = useState(false);
  const [homeSize, setHomeSize] = useState({ width, height: 340 });
  // Background and character share one 1536 × 1024 scene coordinate system.
  // The character's laptop base (768, 860) rests on the desk at (800, 785), with a 2px visual lift.
  const homeScale = Math.max(homeSize.width / 1536, homeSize.height / 1024);
  const sceneLeft = (homeSize.width - 1536 * homeScale) / 2;
  const sceneTop = (homeSize.height - 1024 * homeScale) / 2;
  const characterScale = 0.72;
  const backgroundFrame = { position: 'absolute' as const, left: sceneLeft, top: sceneTop, width: 1536 * homeScale, height: 1024 * homeScale };
  const characterFrame = {
    position: 'absolute' as const,
    left: sceneLeft + (800 - 768 * characterScale) * homeScale,
    top: sceneTop + (785 - 860 * characterScale) * homeScale - 2,
    width: 1536 * characterScale * homeScale,
    height: 1024 * characterScale * homeScale,
  };
  const goal = goalMinutes > 0 ? `오늘 목표 ${goalMinutes % 60 === 0 ? `${goalMinutes / 60}시간` : `${Math.floor(goalMinutes / 60)}시간 ${goalMinutes % 60}분`}` : '오늘은 휴무';
  const friendCount = Math.min(friends.length, Math.max(0, Math.floor(activeFriendCount)));
  const friendMessage = friendCount === 0 ? '오늘의 첫 공부, 먼저 시작해 볼까요?' : `지금 ${friendCount}명이 공부 중이에요`;
  const achieved = goalMinutes > 0 && seconds >= goalMinutes * 60;
  const feedback = (label: string) => setNotice(`${label} 화면은 이번 미리보기 범위에 포함되지 않아요.`);
  const move = (next: 'home' | 'focus') => { setNotice(''); setActiveScreen(next); };
  return <View style={[s.phone, { width, maxWidth: '100%', height }]}>
    <View style={s.statusBar}><Text style={s.statusTime}>9:41</Text><View style={s.statusIcons}><View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>{[5, 8, 11, 14].map(h => <View key={h} style={{ width: 3, height: h, backgroundColor: colors.text, borderRadius: 1 }} />)}</View><View style={s.battery}><View style={s.batteryFill} /></View></View></View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      {activeScreen === 'home' ? <>
        <View style={s.summary}><Text style={[s.body, { fontWeight: '600' }]}>오늘 공부한 시간</Text><View style={s.timeRow}>{homeEntryPreview && <StudyControlView round roundSize={56} running={isRunning} onPress={() => setRunning(value => !value)} />}<Text numberOfLines={1} adjustsFontSizeToFit style={[s.metric, s.timeValue, homeEntryPreview && { fontSize: width < 360 ? 34 : 44 }]}>{clock(seconds)}</Text>{achieved && !homeEntryPreview && <View style={s.timeBadge}><AchievementBadge label="달성 완료" /></View>}</View><Progress seconds={seconds} goalMinutes={goalMinutes} todayLeave={todayLeave} /><View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}><Pressable accessibilityRole="button" accessibilityLabel={todayLeave ? '연차 탭으로 이동' : '오늘 목표 확인'} onPress={() => todayLeave ? onOpenLeave ? onOpenLeave() : setLeaveDetails(true) : feedback('목표')} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={[s.secondary, todayLeave && { color: colors.leave }]}>{todayLeave ? '✈  오늘 연차' : goal}</Text><ChevronRight size={16} color={todayLeave ? colors.leave : colors.secondary} /></Pressable>{homeEntryPreview && achieved && <AchievementBadge label="달성 완료" />}</View></View>
        <View onLayout={({ nativeEvent }) => setHomeSize(nativeEvent.layout)} style={[s.homeScene, homeEntryPreview && { minHeight: sceneMinHeight ?? 180, paddingBottom: 0 }]}>
          {activeSkinId || character !== 'bunny' ? <HomeArtwork character={character} activeSkinId={activeSkinId} width={homeSize.width} height={homeSize.height} /> : <><Image source={imageSource(homeBackground)} resizeMode="contain" style={backgroundFrame} accessibilityLabel="햇살이 드는 공부방" />
          <Image source={imageSource(homeBunny)} resizeMode="contain" style={characterFrame} accessibilityLabel={`${name}의 토끼 캐릭터`} /></>}
          <View style={[s.homeSceneSpace, homeEntryPreview && { minHeight: 180 }]} />
          {renderHomeOverlay?.(homeSize)}
        {homeEntryPreview && friendCount > 0 && <>           <View style={s.friendToast} accessibilityLabel={friendMessage}>
            <>{friendCount > 0 && <View style={s.avatars}>{friends.slice(0, friendCount).map((friend, index) => <View key={friend.name} style={s.avatarSlot}><Image source={imageSource(characters[index + 1])} resizeMode="contain" style={{ width: 30, height: 30 }} accessibilityLabel={`${friend.name} 캐릭터`} /></View>)}</View>}</>
            <Text style={[s.secondary, { flex: 1, color: colors.text }]}>{friendCount === 0 ? '오늘의 첫 공부, 먼저 시작해 볼까요?' : <>{width >= 360 ? '지금 ' : ''}<Text style={{ fontWeight: '700', color: colors.primary }}>{friendCount}명</Text>이 공부 중이에요</>}</Text>
          </View> </>}

          {!homeEntryPreview && <>          <PressableCard style={s.friends} accessibilityLabel={`${friendMessage}, 집중 화면으로 이동`} onPress={() => move('focus')}>
            <>{friendCount > 0 && <View style={s.avatars}>{friends.slice(0, friendCount).map((friend, index) => <View key={friend.name} style={s.avatarSlot}><Image source={imageSource(characters[index + 1])} resizeMode="contain" style={{ width: 30, height: 30 }} accessibilityLabel={`${friend.name} 캐릭터`} /></View>)}</View>}</>
            <Text style={[s.secondary, { flex: 1, color: colors.text }]}>{friendCount === 0 ? '오늘의 첫 공부, 먼저 시작해 볼까요?' : <>{width >= 360 ? '지금 ' : ''}<Text style={{ fontWeight: '700', color: colors.primary }}>{friendCount}명</Text>이 공부 중이에요</>}</Text><ChevronRight size={20} color={colors.secondary} style={{ flexShrink: 0 }} />
          </PressableCard></>}
        </View>
        <View style={[s.actionBar, homeEntryPreview && { justifyContent: 'center', gap: 40 }]}>
          {homeEntryPreview ? <>
            <Button label="공부방 입장하기" accessibilityLabel="공부방 입장하기" onPress={() => move('focus')} style={{ flex: 1, minHeight: 60 }} />
          </> :
          <Button label={isRunning ? 'Ⅱ  일시정지' : '▶  공부 시작'} accessibilityLabel={isRunning ? '공부 일시정지' : '공부 시작'} onPress={() => { if (isRunning) setRunning(false); else { setRunning(true); move('focus'); } }} style={{ flex: 1 }} />}
        </View>
      </> : <>
        <View style={{ flex: 1, minHeight: sceneMinHeight ? sceneMinHeight + 350 : undefined }}><FocusView renderRoomOverlay={renderFocusOverlay} members={[{ id: 'self', name, time: '나', active: isRunning, character, activeSkinId, self: true }, ...friends.map((friend, index) => ({ id: String(index), name: friend.name, time: friend.time, active: index < friendCount, character: (['bear', 'cat', 'puppy'] as const)[index] }))]} memberCount={4} seconds={seconds} sessionSeconds={28 * 60} goalMinutes={goalMinutes} running={isRunning} onBack={() => move('home')} onFriends={() => feedback('친구')} onToggle={() => setRunning(!isRunning)} /></View>
      </>}
      {!!notice && <Pressable accessibilityRole="button" accessibilityLabel="미리보기 안내 닫기" onPress={() => setNotice('')} style={s.notice}><Text accessibilityLiveRegion="polite" style={s.caption}>{notice}  ×</Text></Pressable>}
    </ScrollView>
    <Dialog visible={leaveDetails} label="오늘 연차" embedded onClose={() => setLeaveDetails(false)}><View style={{ padding: 24, borderRadius: 24, backgroundColor: colors.surface, gap: 16 }}><Text style={s.title}>오늘은 연차예요</Text><Text style={s.secondary}>10월 27일 공부 날짜 · 10월 28일 오전 6시까지</Text><Text style={s.secondary}>오늘 목표는 면제돼요. 공부 시간과 실제 목표 달성은 기록되지만 보상 인정 일수에는 포함되지 않아요.</Text><Text style={s.secondary}>이미 사용한 연차는 취소하거나 날짜를 변경할 수 없어요.</Text><DialogCloseButton label="확인" variant="secondary" /></View></Dialog>
    {activeScreen === 'home' && <BottomTabs onSelect={label => label === '홈' ? move('home') : label === '연차' && onOpenLeave ? onOpenLeave() : feedback(label)} />}
  </View>;
}
const s = StyleSheet.create({
  friendToast: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surface, boxShadow: '0 4px 16px rgba(37, 45, 40, 0.14)' },
  phone: { borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  statusBar: { height: 44, paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusTime: { ...typography.label, fontSize: 14, color: colors.text }, statusIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  battery: { width: 23, height: 12, borderWidth: 1, borderColor: colors.text, borderRadius: 3, padding: 2 }, batteryFill: { flex: 1, backgroundColor: colors.text, borderRadius: 1 },
  homeHeader: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 },
  greeting: { ...typography.heading, fontSize: 24, lineHeight: 34, color: colors.text, flex: 1 },
  summary: { marginHorizontal: 24, minHeight: 268, justifyContent: 'center', paddingTop: 32, gap: 20, paddingBottom: 32 },
  timeRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12 }, timeValue: { flex: 1, minWidth: 0 }, timeBadge: { flexShrink: 0, justifyContent: 'center' },
  body: { ...typography.body, color: colors.text }, secondary: { ...typography.secondary, color: colors.secondary }, caption: { ...typography.caption, color: colors.secondary },
  metric: { ...typography.metric, fontSize: 54, color: colors.text, fontVariant: ['tabular-nums'] }, title: { ...typography.title, color: colors.text },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, track: { flex: 1, height: 8, backgroundColor: colors.track, borderRadius: radius.pill, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  art: { flex: 1, minHeight: 210, marginTop: 0, paddingTop: 0, backgroundColor: colors.emptyBackground, alignItems: 'center', justifyContent: 'center', gap: 18 },
  homeScene: { flex: 1, minHeight: 360, paddingBottom: 16, overflow: 'hidden' }, homeSceneSpace: { flex: 1, minHeight: 284 },
  homeArt: { backgroundColor: 'transparent' },
  focusArt: { minHeight: 295, marginTop: 0, paddingTop: 24, justifyContent: 'flex-end', paddingBottom: 58 },
  assetLabel: { alignItems: 'center', gap: 4 }, assetText: { ...typography.label, color: colors.secondary }, assetNote: { ...typography.small, color: colors.secondary },
  soloSlot: { width: 100, height: 72, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.inactive, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  homeCharacter: { width: 260, height: 190 },
  characterImage: { width: '125%', height: 115 },
  seats: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, width: '100%' }, seat: { flex: 1, alignItems: 'center', gap: 12 },
  nameTag: { width: '100%', padding: 8, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', gap: 2 }, tagRow: { flexDirection: 'row', alignItems: 'center', gap: 4 }, name: { ...typography.label, color: colors.text, flexShrink: 1 },
  characterSlot: { height: 74, width: '90%', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.inactive, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  friends: { marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 14, minHeight: 52, gap: 8, flexDirection: 'row', alignItems: 'center' }, row: { flexDirection: 'row', alignItems: 'center', gap: 9 }, dot: { width: 9, height: 9, borderRadius: radius.pill }, chevron: { ...typography.backIcon, color: colors.secondary },
  avatars: { flexDirection: 'row', gap: -10 }, avatarGroup: { position: 'relative' }, avatarSlot: { width: 30, height: 30, borderRadius: radius.pill, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }, initial: { ...typography.label, color: colors.secondary }, avatarDot: { position: 'absolute', bottom: 0, right: 0, borderWidth: 2, borderColor: colors.surface, borderRadius: radius.pill },
  actionBar: { marginHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 16 }, smallControl: { minHeight: interaction.minTouchSize, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: radius.pill }, controlDisc: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }, controlSymbol: { ...typography.title, color: colors.text }, divider: { height: 30, width: 1, backgroundColor: colors.border },
  tabs: { flexDirection: 'row', backgroundColor: colors.navigation, borderTopWidth: 1, borderColor: colors.border, paddingTop: 10, paddingBottom: 14 }, tab: { flex: 1, minWidth: 0, minHeight: 52, alignItems: 'center', justifyContent: 'flex-start', gap: 4 },
  tabIcon: { width: 36, height: 28, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { ...typography.label, width: '100%', textAlign: 'center', lineHeight: 20, includeFontPadding: false },
  focusHeader: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  focusGoalRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 },
  timerPanel: { marginTop: -28, alignItems: 'center', gap: 10, paddingTop: 22, paddingBottom: 24 }, timer: { ...typography.timer, color: colors.text, width: '100%', textAlign: 'center' },
  notice: { marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 12, backgroundColor: colors.leaveBackground },
});
