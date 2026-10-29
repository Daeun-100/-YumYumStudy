import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AchievementProgressIcon } from '../src/design/AchievementProgressIcon';
import { AchievementBadge, SegmentedControl } from '../src/design/components';
import { colors, spacing, typography } from '../src/design/theme';
import { DayDetail, MonthlyCalendar, PeriodHeader, RecordMark } from '../src/features/records/RecordComponents';
import { duration, type StudyRecord } from '../src/features/records/model';
import { BottomTabs } from './screens/StudyLayouts';

const percentages = [0, 10, 25, 50, 75, 90, 100];
const values = [0, 25, 100, 60, 100, 0, 85, 100, 50, 50, 0, 100, 70, 100, 15, 100, 100, 0, 100, 35, 100, 75, 60, 100, 20, 100, 80, 100, 0, 0, 0];
const today = '2026-10-29';
const days: StudyRecord[] = values.map((percent, index) => {
  const number = index + 1;
  const rest = [11, 18, 25].includes(number);
  const leave = number === 10;
  const minutes = rest ? number === 25 ? 36 : 0 : percent * 180 / 100;
  return { date: `2026-10-${String(number).padStart(2, '0')}`, minutes, goal: rest ? 0 : 180,
    status: leave ? 'leave' : rest ? 'rest' : minutes > 0 ? 'study' : 'empty', sessions: [] };
});

function DateMark({ day }: { day: StudyRecord }) {
  if (day.minutes <= 0 || day.goal === null || day.goal <= 0) return <RecordMark kind={day.status} />;
  return <AchievementProgressIcon percent={day.minutes / day.goal * 100} />;
}

function Preview({ mode, percent = 60, width = 390 }: { mode: 'stages' | 'calendar' | 'single'; percent?: number; width?: number }) {
  const [selected, setSelected] = useState('2026-10-23');
  if (mode === 'single') return <AchievementProgressIcon percent={percent} size={48} />;
  if (mode === 'stages') return <View style={{ gap: spacing.xxl }}>
    {[18, 28, 48].map(size => <View key={size} style={{ gap: spacing.lg }}>
      <Text style={{ ...typography.secondary, color: colors.secondary }}>{size}px</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>{percentages.map(value => <View key={value} style={{ minWidth: 44, alignItems: 'center', gap: spacing.sm }}>
        <AchievementProgressIcon percent={value} size={size} /><Text style={{ ...typography.caption, color: colors.secondary }}>{value}%</Text>
      </View>)}</View>
    </View>)}
    <View style={{ gap: spacing.md }}><Text style={{ ...typography.secondary, color: colors.secondary }}>기존 달성 완료 뱃지</Text><AchievementBadge label="달성 완료" /></View>
  </View>;
  const current = days.find(day => day.date === selected)!;
  const elapsed = days.filter(day => day.date <= today);
  return <View style={{ width, maxWidth: '100%', backgroundColor: colors.background, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
    <View style={{ padding: spacing.xl, gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ ...typography.heading, color: colors.text }}>기록</Text><View style={{ width: 136 }}><SegmentedControl accessibilityLabel="기록 기간" value="month" onChange={() => {}} options={[{ label: '주간', value: 'week' }, { label: '월간', value: 'month' }]} /></View></View>
      <PeriodHeader compact title="2026년 10월" previousDisabled nextDisabled onPrevious={() => {}} onNext={() => {}} />
      <View style={{ flexDirection: 'row', gap: spacing.xxl }}>
        <View style={{ flex: 1, gap: 4 }}><Text style={{ ...typography.caption, color: colors.secondary }}>총 공부 시간</Text><Text style={{ ...typography.title, color: colors.text }}>{duration(elapsed.reduce((sum, day) => sum + day.minutes, 0))}</Text></View>
        <View style={{ flex: 1, gap: 4 }}><Text style={{ ...typography.caption, color: colors.secondary }}>목표 달성</Text><Text style={{ ...typography.title, color: colors.primary }}>{elapsed.filter(day => day.goal !== null && day.goal > 0 && day.minutes >= day.goal).length}일</Text></View>
      </View>
      <MonthlyCalendar compact today={today} days={days} selected={selected} onSelect={setSelected} renderDayMark={day => <DateMark day={day} />} />
      <DayDetail day={current} aggregateOnly />
    </View>
    <BottomTabs selected="기록" onSelect={() => {}} />
  </View>;
}

const meta = {
  title: '화면 시안/수박 채움', component: Preview,
  args: { mode: 'stages', percent: 60, width: 390 },
  argTypes: { percent: { control: { type: 'range', min: 0, max: 100, step: 1 } }, mode: { table: { disable: true } }, width: { control: { type: 'range', min: 320, max: 520, step: 10 } } },
  parameters: { docs: { description: { component: '회색 바탕 없이 컬러 수박만 왼쪽 아래부터 20도 사선으로 표시합니다. 달성 완료 뱃지는 기존 그대로이며, 달력은 실제 MonthlyCalendar에 시안용 날짜 표시를 연결합니다. 날짜를 선택하면 실제 상세 컴포넌트가 바뀝니다. 앱 화면 적용 전 검토용으로 실제 기록은 수정하지 않습니다.' } } },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Stages: Story = { name: '달성률별 비교' };
export const Monthly: Story = { name: '월간 기록 적용 시안', args: { mode: 'calendar' }, parameters: { screenLayout: true } };
export const SmallPhone: Story = { name: '월간 · 작은 휴대폰', args: { mode: 'calendar', width: 320 }, parameters: { screenLayout: true } };
export const Adjustable: Story = { name: '채움 비율 조절', args: { mode: 'single' } };
