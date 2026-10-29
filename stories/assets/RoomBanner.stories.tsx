import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Text, View, useWindowDimensions } from 'react-native';
import { StudyLayout } from '../screens/StudyLayouts';
import { RoomBanner } from './RoomBanner';
import { colors, typography } from '../../src/design/theme';

type Props = { message: string; screen: 'comparison' | 'home' | 'focus'; width: number; height: number; visible: boolean };
function Preview({ message, screen, width, height, visible }: Props) {
 const viewport = useWindowDimensions();
 const padding = viewport.width < 600 ? 12 : 24;
 const phoneWidth = Math.min(width, viewport.width - padding * 2);
 const screens = screen === 'comparison' ? ['home','focus'] as const : [screen];
 return <View style={{ padding, gap: 24, alignItems: 'center', backgroundColor: '#F3F0E7', minHeight: '100%' }}>
  <View style={{ width: '100%', maxWidth: 804, gap: 6 }}>
   <Text style={{ ...typography.heading, color: colors.text }}>우리 공부방의 작은 응원</Text>
   <Text style={{ ...typography.body, color: colors.secondary }}>같은 현수막을 홈과 집중에 함께 걸어요.</Text>
  </View>
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 24 }}>
   {screens.map(current => <View key={current} style={{ gap: 12 }}>
    <Text style={{ ...typography.label, color: colors.text }}>{current === 'home' ? '홈 · 햇살 드는 공부방' : '집중 · 함께 공부하는 저녁'}</Text>
    <StudyLayout key={`${current}-${phoneWidth}-${height}`} screen={current} width={phoneWidth} height={height} sceneMinHeight={height < 740 ? 320 : undefined} homeEntryPreview running={false} character="blackcat" activeFriendCount={3}
     renderHomeOverlay={scene => visible ? <RoomBanner screen="home" scene={scene} message={message} /> : null}
     renderFocusOverlay={scene => visible ? <RoomBanner screen="focus" scene={scene} message={message} /> : null} />
   </View>)}
  </View>
 </View>;
}
const meta = {
 title: '화면 시안/공부방 현수막', component: Preview,
 parameters: { layout: 'fullscreen' },
 args: { message: '이번 주도 우리 같이 달려요!', screen: 'comparison', width: 390, height: 844, visible: true },
 argTypes: { screen: { control: 'select', options: ['comparison','home','focus'] } },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Comparison: Story = { name: '홈·집중 함께 보기' };
export const Home: Story = { name: '홈', args: { screen: 'home' } };
export const Focus: Story = { name: '집중', args: { screen: 'focus' } };
export const Small: Story = { name: '작은 화면 · 320', args: { width: 320, height: 640 } };
export const LongMessage: Story = { name: '긴 문구 · 두 줄', args: { message: '조금 느려도 괜찮아, 오늘의 작은 집중이 내일의 나를 만들어!' } };
export const Hidden: Story = { name: '게시하지 않은 상태', args: { visible: false } };
