import { StudyControlView } from '../src/features/study/StudyControlView';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { FocusView } from '../src/features/study/FocusView';
import { HomeArtwork } from '../src/features/study/HomeArtwork';
import { BottomTabs } from '../src/features/navigation/BottomTabs';
import { colors, typography } from '../src/design/theme';

function Preview({ screen = 'focus', initialLoading = false }: { screen?: 'home' | 'focus'; initialLoading?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(initialLoading);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timeout.current), []);
  const reload = () => {
    if (busy || loaded) return;
    setBusy(true);
    timeout.current = setTimeout(() => { setLoaded(true); setBusy(false); }, 1200);
  };
  const control = <StudyControlView round={screen === 'focus'} reload={!loaded} busy={busy} onPress={reload} />;
  return <View style={{ width: 390, maxWidth: '100%', height: 844, backgroundColor: colors.background }}>
    <View style={{ height: 36, paddingHorizontal: 24, justifyContent: 'center' }}><Text style={{ ...typography.caption, color: colors.text }}>9:41</Text></View>
    {screen === 'focus' ? <FocusView members={[{ id: 'self', name: '다이앤', time: '나', active: false, character: 'bunny', self: true }]} memberCount={null} seconds={loaded ? 0 : null} sessionSeconds={0} goalMinutes={loaded ? 120 : null} running={false} onBack={() => {}} onFriends={() => {}} onAllowedApps={() => {}} onToggle={() => {}} timerControl={control} /> : <>
      <View style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 20, minHeight: 268, gap: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ ...typography.body, color: colors.text }}>오늘 전체 공부 시간</Text><Text style={{ ...typography.caption, color: colors.primary }}>허용앱</Text></View>
        <Text style={{ ...typography.metric, fontSize: 54, color: colors.text }}>{loaded ? '00:00:00' : '—'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ height: 8, flex: 1, backgroundColor: colors.track, borderRadius: 99 }} /><Text style={{ ...typography.secondary, color: colors.secondary }}>{loaded ? '0%' : '—'}</Text></View>
        <Text style={{ ...typography.secondary, color: colors.secondary }}>{loaded ? '오늘 목표 2시간  ›' : '오늘 목표 —'}</Text>
      </View>
      <View style={{ flex: 1, overflow: 'hidden' }}><HomeArtwork character="bunny" width={390} height={390} /><View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, borderRadius: 16, padding: 16, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center' }}><Text style={{ ...typography.secondary, color: colors.text, flex: 1 }}>함께 공부하는 친구들</Text><ChevronRight size={20} color={colors.secondary} /></View></View>
      <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>{control}</View>
      <BottomTabs selected="홈" onSelect={() => {}} />
    </>}
  </View>;
}
const meta = { title: '화면/새로고침 시안', component: Preview, parameters: { screenLayout: true, layout: 'fullscreen' } } satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Focus: Story = { name: '집중 · 새로고침', args: { screen: 'focus' } };
export const Home: Story = { name: '홈 · 새로고침', args: { screen: 'home' } };
export const FocusLoading: Story = { name: '집중 · 버튼 안 로딩', args: { screen: 'focus', initialLoading: true } };
export const HomeLoading: Story = { name: '홈 · 버튼 안 로딩', args: { screen: 'home', initialLoading: true } };
