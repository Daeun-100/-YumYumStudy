import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { FocusView } from '../src/features/study/FocusView';
import { colors } from '../src/design/theme';

const meta = {
  title: '화면/집중',
  component: FocusView,
  parameters: { screenLayout: true, layout: 'fullscreen' },
  decorators: [Story => <View style={{ width: 390, height: 844, maxWidth: '100%', backgroundColor: colors.background }}><Story /></View>],
  args: {
    initialSceneSize: { width: 390, height: 494 },
    members: [
      { id: 'self', name: '다이앤', time: '나', active: true, character: 'bunny', self: true },
      { id: 'friend', name: '민지', time: '53분', active: true, character: 'bear' },
    ],
    memberCount: 2,
    seconds: 5400,
    sessionSeconds: 1680,
    goalMinutes: 180,
    running: true,
    onBack: () => {},
    onFriends: () => {},
    onToggle: () => {},
  },
} satisfies Meta<typeof FocusView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const InProgress: Story = { name: '집중 · 목표 미달성 (50%)' };
export const Achieved: Story = { name: '집중 · 목표 달성 (100%)', args: { seconds: 10800 } };
export const Exceeded: Story = { name: '집중 · 목표 초과 달성 (125%)', args: { seconds: 13500 } };
export const MultipleAchievers: Story = {
  name: '집중 · 친구 여러 명 목표 달성',
  args: {
    members: [
      { id: 'self', name: '다이앤', time: '나', active: true, character: 'bunny', self: true },
      { id: 'friend-1', name: '민지', time: '1시간 0분', active: true, character: 'bear', achieved: true },
      { id: 'friend-2', name: '지수', time: '2시간 0분', active: false, character: 'cat', achieved: true },
      { id: 'friend-3', name: '수빈', time: '30분', active: true, character: 'puppy', achieved: false },
    ],
    memberCount: 4,
  },
};
