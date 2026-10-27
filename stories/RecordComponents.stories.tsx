import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { useState } from 'react';
import { DayDetail, GoalProgress, PeriodHeader, RecordLegend, SessionRow } from '../src/features/records/RecordComponents';
import { previewRecord } from '../src/features/records/model';
function Example({ example }: { example: 'period' | 'progress' | 'legend' | 'session' | 'day' }) {
  const [month, setMonth] = useState(10);
  if (example === 'period') return <PeriodHeader title={`2026년 ${month}월`} onPrevious={() => setMonth(Math.max(1, month - 1))} onNext={() => setMonth(Math.min(12, month + 1))} />;
  if (example === 'progress') return <View style={{ gap: 24 }}><GoalProgress minutes={135} goal={180} /><GoalProgress minutes={210} goal={180} /><GoalProgress minutes={0} goal={0} /><GoalProgress minutes={45} goal={null} /></View>;
  if (example === 'legend') return <RecordLegend />;
  if (example === 'session') return <SessionRow session={{ start: '09:00', end: '10:00', minutes: 60 }} />;
  return <DayDetail day={previewRecord('2026-10-16')} />;
}
const meta = { title: '공통 컴포넌트/기록', component: Example, args: { example: 'period' } } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Period: Story = { name: '기간 이동' };
export const Progress: Story = { name: '목표 진행률', args: { example: 'progress' } };
export const Legend: Story = { name: '기록 상태 범례', args: { example: 'legend' } };
export const Session: Story = { name: '세션 목록 행', args: { example: 'session' } };
export const Day: Story = { name: '선택 날짜 상세', args: { example: 'day' } };
