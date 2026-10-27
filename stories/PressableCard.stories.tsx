import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Text, View } from 'react-native';
import { PressableCard } from '../src/design/components';
import { colors, spacing, typography } from '../src/design/theme';
const meta = {
  title: '공통 컴포넌트/누르는 카드', component: PressableCard,
  args: { disabled: false, accessibilityLabel: '친구 현황 보기' },
  argTypes: { disabled: { control: 'boolean' }, children: { control: false }, style: { control: false } },
  render: function Interactive(args) {
    const [count, setCount] = useState(0);
    return <View style={{ gap: spacing.md }}><PressableCard {...args} onPress={() => setCount(count + 1)}><Text style={[typography.body, { color: colors.text }]}>친구 현황 보기  ›</Text><Text style={[typography.caption, { color: colors.secondary }]}>누르고 있으면 배경색이 바뀌어요.</Text></PressableCard><Text style={typography.caption}>미리보기 클릭 횟수: {count}</Text></View>;
  },
} satisfies Meta<typeof PressableCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: '클릭해 보기' };
export const Disabled: Story = { name: '비활성', args: { disabled: true } };
