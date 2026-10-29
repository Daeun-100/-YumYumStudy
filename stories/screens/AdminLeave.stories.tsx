import { useState } from 'react';
import { Text, View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { LeaveView } from '../../src/features/leave/LeaveView';
import { decodeLeaveStatus } from '../../src/data/decode';
import { leaveGrantView } from '../../src/features/leave/model';
import { colors, typography } from '../../src/design/theme';
import { monthStart, parseDate, previewRecord, shiftDate, shiftMonth } from '../../src/features/records/model';
import { BottomTabs } from '../../src/features/navigation/BottomTabs';

const today = '2026-10-28';
const earnedAt = '2026-10-28T12:00:00+09:00';
const grants = decodeLeaveStatus({ revision: 3, availableCount: 2, grants: [
  { id: 'free', kind: 'free', status: 'AVAILABLE', earnedAt: '2026-10-26T06:00:00+09:00', earningWeek: '2026-10-26', expiresAt: '2026-11-02T06:00:00+09:00', scheduledDate: null },
  { id: 'reward', kind: 'reward', status: 'AVAILABLE', earnedAt: '2026-10-24T12:00:00+09:00', earningWeek: '2026-10-19', expiresAt: '2026-11-09T06:00:00+09:00', scheduledDate: null },
  ...[
    { id: 'admin-past', status: 'USED', scheduledDate: '2026-10-21' },
    { id: 'admin-today', status: 'USED', scheduledDate: today },
    { id: 'admin-future', status: 'SCHEDULED', scheduledDate: '2026-10-30' },
  ].map(g => ({ ...g, kind: 'admin', earnedAt, approvedAt: earnedAt, earningWeek: null, expiresAt: null })),
  { id: 'normal-future', kind: 'reward', status: 'SCHEDULED', earnedAt: '2026-10-17T12:00:00+09:00', earningWeek: '2026-10-12', expiresAt: '2026-11-02T06:00:00+09:00', scheduledDate: '2026-10-31' },
] }).grants.map(leaveGrantView);
function Preview({ date, home = false, width = 390 }: { date?: string; home?: boolean; width?: number }) {
  const [month, setMonth] = useState(monthStart(date ?? today));
  const days = Array.from({ length: parseDate(shiftDate(shiftMonth(month, 1), -1)).getUTCDate() }, (_, i) => {
    const day = previewRecord(shiftDate(month, i));
    return { ...day, status: grants.some(g => g.date === day.date) ? 'leave' as const : day.status === 'leave' ? 'empty' as const : day.status };
  });
  return <View style={{ width, maxWidth: '100%', height: 844, borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
    <View style={{ height: 44, paddingHorizontal: 24, justifyContent: 'center' }}><Text style={typography.label}>9:41</Text></View>
    <LeaveView embedded initialScreen={home ? 'home' : 'calendar'} initialDate={date} today={today} grants={grants}
      weeklyDays={4} calendarDays={days} onMonthChange={setMonth} onClearNotice={() => {}} onRefresh={async () => {}}
      navigation={<BottomTabs selected="연차" onSelect={() => {}} />}
      unavailable={() => '스토리북 미리보기에서는 새 연차를 등록하지 않아요.'}
      onApply={async () => false} onCancel={async () => false} />
  </View>;
}
const meta = {
  title: '화면/관리자 연차', component: Preview,
  parameters: { screenLayout: true, layout: 'fullscreen', docs: { description: { component: '관리자 연차 UI 미리보기. 잔액 2개는 무료·보상만 집계합니다. 관리자 연차는 지정일에 표시되며 변경·취소 버튼과 만료일, 운영 사유를 노출하지 않습니다. DB와 연결하지 않은 샘플입니다.' } } },
  args: { date: '2026-10-30', home: false, width: 390 },
  render: args => <Preview key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Schedule: Story = { name: '메인 · 관리자와 일반 일정', args: { home: true } };
export const Future: Story = { name: '관리자 · 미래 예약 (변경·취소 없음)' };
export const Today: Story = { name: '관리자 · 오늘 사용', args: { date: today } };
export const Past: Story = { name: '관리자 · 과거 적용', args: { date: '2026-10-21' } };
export const Regular: Story = { name: '비교 · 일반 예약 (변경·취소 가능)', args: { date: '2026-10-31' } };
export const Small: Story = { name: '320px · 관리자 미래 예약', args: { width: 320 } };
