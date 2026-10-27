import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { FriendsLayout } from './FriendsLayout';

const meta = {
  title: '화면 시안/친구',
  component: FriendsLayout,
  parameters: { screenLayout: true, layout: 'fullscreen', docs: { description: { component: '카드 없이 구분선으로 나눈 친구 목록입니다. 친구를 선택하면 해당 친구의 주간·월간 기록, 날짜별 공부 시간과 목표, 세션 목록으로 이어지는 스토리북 전용 시안입니다. 표시되는 기록은 샘플 데이터입니다.' } } },
  args: { state: 'ready', width: 390, height: 844, longName: false },
  argTypes: {
    state: { control: 'select', options: ['ready', 'stale', 'error', 'loading', 'empty'] },
    width: { control: { type: 'range', min: 320, max: 430, step: 1 } },
    height: { control: { type: 'range', min: 640, max: 932, step: 1 } },
    longName: { control: 'boolean' },
  },
  render: args => <FriendsLayout key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof FriendsLayout>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: '친구 · 구성원 목록' };
export const Stale: Story = { name: '친구 · 갱신 지연', args: { state: 'stale' } };
export const Error: Story = { name: '친구 · 연결 끊김', args: { state: 'error' } };
export const Loading: Story = { name: '친구 · 불러오는 중', args: { state: 'loading' } };
export const Empty: Story = { name: '친구 · 빈 공부방', args: { state: 'empty' } };
export const SmallPhone: Story = { name: '친구 · 작은 휴대폰과 긴 이름', args: { width: 320, height: 740, longName: true } };

export const Records: Story = { name: '친구 · 공부 기록', args: { initialMemberId: '1' } };
export const RestRecords: Story = { name: '친구 · 휴무 기록', args: { initialMemberId: '4' } };
export const RecordsSmallPhone: Story = { name: '친구 · 기록 작은 화면', args: { initialMemberId: '1', width: 320, longName: true } };
