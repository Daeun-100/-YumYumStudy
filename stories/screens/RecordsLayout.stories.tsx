import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { RecordsLayout } from './RecordsLayout';
const meta = {
  title: '화면 시안/기록', component: RecordsLayout,
  parameters: { screenLayout: true, layout: 'fullscreen', docs: { description: { component: '주간 목표·실제 시간 차트와 월간 달력. 기간 이동과 날짜 선택이 동작하며, 세션별 시작·종료 시각과 공부 시간은 목록에서 확인합니다. 고정된 샘플 데이터로 구성되며 실제 기록을 수정하지 않습니다. 친구 기록과 같은 컴포넌트를 사용합니다.' } } },
  args: { initialPeriod: 'week', initialDate: '2026-10-16', width: 390, height: 844, empty: false },
  argTypes: { initialPeriod: { control: 'select', options: ['week', 'month'] }, width: { control: { type: 'range', min: 320, max: 520 } }, height: { control: { type: 'range', min: 640, max: 1100 } } },
  render: args => <RecordsLayout key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof RecordsLayout>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Weekly: Story = { name: '기록 · 주간' };
export const Monthly: Story = { name: '기록 · 월간', args: { initialPeriod: 'month' } };
export const Achieved: Story = { name: '기록 · 목표 달성', args: { initialDate: '2026-10-26' } };
export const Rest: Story = { name: '기록 · 쉬는 날', args: { initialPeriod: 'month', initialDate: '2026-10-18' } };
export const Leave: Story = { name: '기록 · 연차', args: { initialPeriod: 'month', initialDate: '2026-10-10' } };
export const Empty: Story = { name: '기록 · 기록 없음', args: { empty: true } };
export const SmallPhone: Story = { name: '기록 · 작은 휴대폰', args: { initialPeriod: 'month', width: 320, height: 740 } };

export const WeeklyLeave: Story = { name: '기록 · 주간 연차 포함', args: { initialPeriod: 'week', initialDate: '2026-10-10' } };
