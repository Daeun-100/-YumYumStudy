import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { View } from 'react-native';
import { BottomTabs } from '../src/features/navigation/BottomTabs';

function BottomTabsExample({ width = 390 }: { width?: number }) {
  const [selected, setSelected] = useState('홈');
  return <View style={{ width, maxWidth: '100%' }}><BottomTabs selected={selected} onSelect={setSelected} /></View>;
}

const meta = {
  title: '공통 컴포넌트/하단 탭',
  component: BottomTabsExample,
  args: { width: 390 },
} satisfies Meta<typeof BottomTabsExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: '기본 · 눌러서 선택' };
export const SmallPhone: Story = { name: '작은 휴대폰', args: { width: 320 } };
