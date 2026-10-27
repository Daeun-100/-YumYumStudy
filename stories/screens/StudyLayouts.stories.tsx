import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Text, View } from 'react-native';
import { colors, spacing, typography } from '../../src/design/theme';
import { StudyLayout } from './StudyLayouts';
const meta = {
  title: '화면 시안/홈과 집중', component: StudyLayout,
  parameters: { screenLayout: true, layout: 'fullscreen', docs: { description: { component: '스토리북 전용 UI 시안입니다. 프로젝트의 배경·캐릭터 에셋을 연결한 시안입니다. 공부 중에는 샘플 시간이 초 단위로 증가하며, 시작/일시정지 및 홈↔집중 전환은 미리보기 안에서만 동작합니다. 실제 앱이나 서버 기록에는 영향을 주지 않습니다.' } } },
  args: { screen: 'home', running: true, seconds: 4815, goalMinutes: 180, activeFriendCount: 2, name: '다이앤', width: 390, height: 844 },
  argTypes: { activeFriendCount: { control: { type: 'range', min: 0, max: 3, step: 1 } }, screen: { control: 'select', options: ['home', 'focus'] }, running: { control: 'boolean' }, seconds: { control: { type: 'number', min: 0, step: 1 } }, goalMinutes: { control: { type: 'number', min: 0, max: 1440 } }, width: { control: { type: 'range', min: 320, max: 430, step: 1 } }, height: { control: { type: 'range', min: 640, max: 932, step: 1 } } },
  render: args => <StudyLayout key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof StudyLayout>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Home: Story = { name: '홈 · 공부 중' };
export const Focus: Story = { name: '집중 · 공부 중', args: { screen: 'focus' } };
export const HomePaused: Story = { name: '홈 · 쉬는 중', args: { running: false } };
export const FocusPaused: Story = { name: '집중 · 쉬는 중', args: { screen: 'focus', running: false } };
export const Achieved: Story = { name: '집중 · 목표 초과 달성', args: { screen: 'focus', seconds: 13284 } };
export const SmallPhone: Story = { name: '홈 · 작은 휴대폰', args: { width: 320, height: 740 } };
export const Comparison: Story = { name: '홈·집중 나란히', parameters: { controls: { disable: true } }, render: () => <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', gap: 32 }}>{(['home', 'focus'] as const).map(screen => <View key={screen} style={{ gap: spacing.md, maxWidth: '100%' }}><Text style={[typography.title, { color: colors.text, textAlign: 'center' }]}>{screen === 'home' ? '홈 화면' : '집중 화면'}</Text><StudyLayout screen={screen} /></View>)}</View> };

export const HomeAchieved: Story = { name: '홈 · 목표 달성 완료', args: { seconds: 10800 } };
export const HomeAchievedSmall: Story = { name: '홈 · 목표 달성 작은 화면', args: { seconds: 10800, width: 320, height: 740 } };

export const NoFriendsStudying: Story = { name: '홈 · 공부 중인 친구 없음', args: { activeFriendCount: 0, running: false } };
export const OneFriendStudying: Story = { name: '홈 · 친구 1명 공부 중', args: { activeFriendCount: 1 } };

export const ShortPhone: Story = { name: '홈 · 낮은 화면 배경 정렬', args: { width: 375, height: 640, running: false } };
export const TallPhone: Story = { name: '홈 · 긴 화면 배경 정렬', args: { width: 430, height: 932, running: false } };
