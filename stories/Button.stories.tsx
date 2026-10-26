import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';
import { Button } from '../src/design/components';

const meta = {
  title: '공통 컴포넌트/버튼', component: Button,
  args: { label: '공부 시작', variant: 'primary', size: 'default', disabled: false, loading: false, onPress: fn() },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'raised', 'ghost'], description: '기본 초록 / 보조 / 불투명 크림 / 배경 없는 이동 버튼' },
    size: { control: 'select', options: ['default', 'compact', 'round', 'icon'] },
    label: { control: 'text' }, disabled: { control: 'boolean' }, loading: { control: 'boolean' },
    style: { control: false },
  },
  parameters: { docs: { description: { component: '실제 앱에서 사용하는 버튼입니다. 일반 버튼은 불투명 배경을 사용하고, 이동 버튼은 배경 없는 ghost 변형을 사용합니다. 누르면 색상이 바뀝니다. 로딩 중이거나 비활성일 때는 클릭되지 않습니다.' } } },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Primary: Story = { name: '기본' };
export const Secondary: Story = { name: '보조', args: { variant: 'secondary', label: '다른 날짜 선택하기' } };
export const Raised: Story = { name: '불투명 크림', args: { variant: 'raised', label: '친구 4' } };
export const Compact: Story = { name: '작은 버튼', args: { size: 'compact', label: '확인' } };
export const Round: Story = { name: '원형 타이머', args: { size: 'round', label: 'Ⅱ', accessibilityLabel: '공부 일시정지' } };
export const Icon: Story = { name: '아이콘', args: { size: 'icon', variant: 'ghost', label: '←', accessibilityLabel: '뒤로가기' } };
export const Loading: Story = { name: '로딩', args: { loading: true } };
export const Disabled: Story = { name: '비활성', args: { disabled: true } };
