import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Text, View } from 'react-native';
import { colors, spacing, typography } from '../src/design/theme';
import { LeaveBadge, LeaveIcon, LeaveInfo, WeeklyLeaveProgress } from './screens/LeaveLayout';

const meta = { title: '공통 컴포넌트/연차 시안', parameters: { docs: { description: { component: '연차 화면에서 사용하는 부품의 스토리북 전용 시안입니다. 기존 테마의 단색 표면·수박 달성 표시·파란 연차 색상을 사용합니다.' } } } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const States: Story = { name: '상태 아이콘과 배지', render: () => <View style={{ gap: spacing.xl }}>{(['available', 'scheduled', 'used', 'expired'] as const).map(state => <View key={state} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}><LeaveIcon state={state} /><LeaveBadge state={state} /></View>)}<View style={{ flexDirection: 'row', gap: spacing.sm }}><LeaveBadge state="available" label="3일 남음" /><LeaveBadge state="scheduled" label="1" /></View></View> };
export const Progress: Story = { name: '주간 획득 조건', render: () => <View style={{ gap: spacing.lg }}><WeeklyLeaveProgress days={0} /><WeeklyLeaveProgress days={4} /><WeeklyLeaveProgress days={6} /></View> };
export const Guidance: Story = { name: '규칙 안내', render: () => <View style={{ gap: spacing.lg }}><Text style={[typography.title, { color: colors.text }]}>연차 사용 안내</Text><LeaveInfo>{'현재 공부 날짜 이후에만 예약할 수 있어요. 사용일 오전 6시 전까지 취소할 수 있어요.'}</LeaveInfo><LeaveInfo>{'연차는 획득한 주의 다음 주 월요일 오전 6시부터 2주 뒤에 만료돼요.'}</LeaveInfo></View> };
