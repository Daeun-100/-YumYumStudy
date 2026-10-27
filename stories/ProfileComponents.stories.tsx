import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { TimeWheelPicker } from '../src/features/profile/TimeWheelPicker';
import { View } from 'react-native';
import { SettingsRow, InfoNotice, WeeklyAchievement } from '../src/features/profile/ProfileComponents';
const meta = { title: '공통 컴포넌트/설정 행', component: SettingsRow, args: { label: '목표 설정', icon: '◎', description: '요일마다 나에게 맞는 공부량', value: '주 19시간', onPress: () => {} } } satisfies Meta<typeof SettingsRow>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: '메뉴 행' };
export const Weekday: Story = { name: '요일 · 변경한 목표', args: { label: '수요일', description: undefined, value: '4시간', selected: true } };
export const Rest: Story = { name: '요일 · 쉬는 날', args: { label: '일요일', description: undefined, value: '쉬는 날' } };
export const Notice: Story = { name: '적용 시점 안내', render: () => <View><InfoNotice title="변경한 목표는 언제 적용되나요?">다음 공부 날짜 오전 6시부터 적용돼요. 오늘의 목표와 과거 기록은 그대로 유지돼요.</InfoNotice></View> };

export const Weekly: Story = { name: "박스 없는 주간 달성 현황", render: () => <WeeklyAchievement achievedDays={4} /> };
export const WeeklyComplete: Story = { name: "주간 달성 완료", render: () => <WeeklyAchievement achievedDays={6} /> };

function WheelDemo() {
  const [value, setValue] = useState(210);
  return <TimeWheelPicker value={value} onChange={setValue} />;
}
export const TimeWheel: Story = { name: '시간 · 스크롤 휠', render: () => <WheelDemo /> };
