import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Text } from 'react-native';
import { Card } from '../src/design/components';
import { colors, typography } from '../src/design/theme';
const meta = {
  title: '공통 컴포넌트/카드', component: Card,
  args: { variant: 'default', children: <><Text style={[typography.secondary, { color: colors.secondary }]}>오늘 공부한 시간</Text><Text style={[typography.metric, { color: colors.text }]}>1시간 20분</Text><Text style={[typography.caption, { color: colors.secondary }]}>미리보기용 예시 · 오늘 목표 3시간</Text></> },
  argTypes: { variant: { control: 'select', options: ['default', 'compact', 'panel'] }, children: { control: false }, style: { control: false } },
} satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: '기본 카드' };
export const Compact: Story = { name: '작은 카드', args: { variant: 'compact' } };
export const Panel: Story = { name: '하단 패널', args: { variant: 'panel' } };
