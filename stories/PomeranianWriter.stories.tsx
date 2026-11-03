import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { StudyLayout } from './screens/StudyLayouts';

const meta = {
  title: '화면/포메라니안 작가 스킨',
  component: StudyLayout,
  parameters: { layout: 'fullscreen', screenLayout: true },
  args: { screen: 'home', character: 'pomeranian', activeSkinId: 'pomeranian-writer', running: true, width: 390, height: 844 },
  render: args => <StudyLayout key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof StudyLayout>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Home: Story = { name: '홈 · 웹소설 작가 포메라니안' };
export const Focus: Story = { name: '집중 · 웹소설 작가 포메라니안', args: { screen: 'focus' } };
export const SmallHome: Story = { name: '홈 · 작은 화면', args: { width: 320, height: 640 } };
export const SmallFocus: Story = { name: '집중 · 작은 화면', args: { screen: 'focus', width: 320, height: 640 } };
