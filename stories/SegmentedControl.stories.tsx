import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Text, View } from 'react-native';
import { SegmentedControl } from '../src/design/components';
import { colors, spacing, typography } from '../src/design/theme';
function TabsExample({ disabledMonthly = false, initialValue = 'week' }: { disabledMonthly?: boolean; initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return <View style={{ gap: spacing.lg }}><SegmentedControl accessibilityLabel="기록 기간" value={value} onChange={setValue}
    options={[{ value: 'week', label: '주간' }, { value: 'month', label: '월간', disabled: disabledMonthly }]} />
    <Text style={[typography.secondary, { color: colors.secondary }]}>선택한 기간: {value === 'week' ? '주간' : '월간'} · 탭을 눌러 바꿔보세요.</Text></View>;
}
const meta = { title: '공통 컴포넌트/전환 탭', component: TabsExample, args: { disabledMonthly: false, initialValue: 'week' }, argTypes: { initialValue: { control: false } } } satisfies Meta<typeof TabsExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Weekly: Story = { name: '주간 선택' };
export const Monthly: Story = { name: '월간 선택', args: { initialValue: 'month' } };
export const Disabled: Story = { name: '월간 비활성', args: { disabledMonthly: true } };
