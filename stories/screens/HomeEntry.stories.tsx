import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { StudyLayout } from './StudyLayouts';

const meta = {
  title: '화면/홈 공부방 입장',
  component: StudyLayout,
  parameters: { layout: 'fullscreen', screenLayout: true },
  args: { screen: 'home', homeEntryPreview: true, running: true, activeFriendCount: 3, width: 390, height: 844 },
  render: args => <StudyLayout key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof StudyLayout>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Running: Story = { name: '공부 중 · 원형 버튼' };
export const Paused: Story = { name: '쉬는 중 · 원형 버튼', args: { running: false } };
export const Small: Story = { name: '작은 화면', args: { width: 320, height: 640 } };
export const NoFriends: Story = { name: '공부 중인 친구 없음', args: { activeFriendCount: 0, running: false } };
export const Achieved: Story = { name: '목표 달성 · 배지 배치 확인', args: { seconds: 10800 } };
export const AchievedSmall: Story = { name: '목표 달성 · 작은 화면', args: { seconds: 10800, width: 320, height: 640 } };
