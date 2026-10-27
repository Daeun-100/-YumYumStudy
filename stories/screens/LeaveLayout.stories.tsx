import { characterIds } from '../../src/lib/characters';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { LeaveLayout } from './LeaveLayout';

const meta = {
  title: '화면 시안/연차', component: LeaveLayout,
  parameters: { screenLayout: true, layout: 'fullscreen', docs: { description: { component: '메인과 달력, 두 화면으로 구성한 연차 UI 시안입니다. 메인은 잔액 카드만 유지하고 주간 달성과 예약을 구분선으로 정리한 고정 화면입니다. 만료 내역과 이용 안내는 별도 창에서 확인하고, 달력에서 연차 사용·날짜 변경·취소와 지난 사용일을 확인합니다. 모든 동작은 샘플 데이터만 변경하며 앱·서버·저장소와 연결하지 않습니다.' } } },
  args: { character: 'bunny', initialScreen: 'home', state: 'ready', weeklyDays: 4, width: 390, height: 844, initialConfirmation: false, initialChanging: false },
  argTypes: { character: { control: 'select', options: characterIds },
    initialScreen: { control: 'select', options: ['home', 'calendar'] },
    state: { control: 'select', options: ['ready', 'empty', 'loading', 'error'] },
    weeklyDays: { control: { type: 'range', min: 0, max: 6, step: 1 } },
    width: { control: { type: 'range', min: 320, max: 430, step: 1 } },
    height: { control: { type: 'range', min: 640, max: 932, step: 1 } },
    initialDate: { control: 'text' },
  },
  render: args => <LeaveLayout key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof LeaveLayout>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Home: Story = { name: '연차 · 메인' };
export const Calendar: Story = { name: '연차 · 달력', args: { initialScreen: 'calendar' } };
export const AvailableDate: Story = { name: '달력 · 연차 사용', args: { initialScreen: 'calendar', initialDate: '2026-10-30' } };
export const ReservedDate: Story = { name: '달력 · 예약 확인', args: { initialScreen: 'calendar', initialDate: '2026-10-29' } };
export const ChangeDate: Story = { name: '달력 · 날짜 변경', args: { initialScreen: 'calendar', initialDate: '2026-10-30', initialChanging: true } };
export const UsedDate: Story = { name: '달력 · 지난 사용일', args: { initialScreen: 'calendar', initialDate: '2026-10-21' } };
export const Cancel: Story = { name: '달력 · 취소 확인', args: { initialScreen: 'calendar', initialDate: '2026-10-29', initialConfirmation: true } };
export const UnavailableDate: Story = { name: '달력 · 예약 불가', args: { initialScreen: 'calendar', initialDate: '2026-11-20' } };
export const Earned: Story = { name: '연차 · 주간 획득 완료', args: { weeklyDays: 6 } };
export const Empty: Story = { name: '연차 · 잔액과 예약 없음', args: { state: 'empty', weeklyDays: 0 } };
export const EmptyCalendar: Story = { name: '달력 · 잔액 없음', args: { initialScreen: 'calendar', state: 'empty' } };
export const Loading: Story = { name: '연차 · 불러오는 중', args: { state: 'loading' } };
export const Error: Story = { name: '연차 · 연결 오류', args: { state: 'error' } };
export const SmallPhone: Story = { name: '연차 · 작은 휴대폰', args: { width: 320, height: 740 } };
export const SmallCalendar: Story = { name: '달력 · 작은 휴대폰', args: { initialScreen: 'calendar', initialDate: '2026-10-29', width: 320, height: 740 } };

export const Today: Story = { name: '달력 · 오늘 날짜', args: { initialScreen: 'calendar', initialDate: '2026-10-26' } };
export const RestDay: Story = { name: '달력 · 쉬는 날', args: { initialScreen: 'calendar', initialDate: '2026-11-01' } };

export const ConfirmUse: Story = { name: '달력 · 사용 확인', args: { initialScreen: 'calendar', initialDate: '2026-10-30', initialConfirmation: 'use' } };
export const ConfirmChange: Story = { name: '달력 · 변경 확인', args: { initialScreen: 'calendar', initialDate: '2026-10-30', initialChanging: true, initialConfirmation: 'change' } };
