import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { ScrollView, Text, View } from 'react-native';
import { colors, spacing, typography } from '../src/design/theme';
import { RecordsPreview } from '../src/features/records/RecordsPreview';
import { SettingsRow, WeeklyAchievement } from '../src/features/profile/ProfileComponents';
import { type StudyRecord } from '../src/features/records/model';
import { BottomTabs } from './screens/StudyLayouts';

// Presentation fixtures only. No reward eligibility or server mutations are introduced.
const goldDates = ['2026-10-11', '2026-10-25'];
const today = '2026-10-25';
const days: StudyRecord[] = Array.from({ length: 31 }, (_, index) => {
  const n = index + 1;
  const date = `2026-10-${String(n).padStart(2, '0')}`;
  const leave = n === 14;
  const rest = n === 18;
  const complete = (n >= 5 && n <= 11) || (n >= 19 && n <= 25);
  return { date, goal: rest ? 0 : 180, minutes: date > today || leave || rest ? 0 : complete ? 180 + n % 4 * 15 : n % 3 * 60,
    status: leave ? 'leave' : rest ? 'rest' : date > today ? 'empty' : 'study', sessions: [] };
});

function Preview({ mode = 'week', width = 390 }: { mode?: 'week' | 'month' | 'calendar' | 'profile'; width?: number }) {
  const profile = mode === 'profile';
  return <View style={{ width, maxWidth: '100%', height: 844, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
    <View style={{ height: 44, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text>9:41</Text><Text>● ● ▰</Text></View>
    {profile ? <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Text style={{ ...typography.heading, color: colors.text }}>얌얌님</Text>
      <>
        <Text style={{ ...typography.secondary, color: colors.secondary }}>나의 공부와 설정</Text>
        <WeeklyAchievement weekdayProgress={[100, 100, 100, 100, 100, 100, 100]} superWatermelon />
        <View style={{ height: 1, backgroundColor: colors.track }} />
        <SettingsRow label="공부 목표 설정" icon="◎" value="주 21시간" onPress={() => {}} />
        <SettingsRow label="허용앱 설정" description="공부 중 사용할 앱을 관리해요" onPress={() => {}} />
        <SettingsRow label="공부와 연차 이용 안내" onPress={() => {}} />
      </>
    </ScrollView> : <RecordsPreview key={mode} initialPeriod={mode === 'week' ? 'week' : 'month'} initialDate={today} today={today} records={days.map(day => ({ ...day, superWatermelon: goldDates.includes(day.date) }))} />}
    <BottomTabs selected={profile ? '나' : '기록'} onSelect={() => {}} />
  </View>;
}

const meta = {
  title: '화면 시안/금색 수박', component: Preview,
  args: { mode: 'week', width: 390 },
  parameters: { screenLayout: true, docs: { description: { component: '금색 수박 에셋의 화면 적용 시안. 10월 5~11일과 19~25일 완주 샘플로 일요일만 금색 수박을 표시합니다. 실제 기록·보상 지급에는 연결하지 않습니다. 주간·월간 전환 및 날짜 선택이 가능합니다.' } } },
  argTypes: { mode: { table: { disable: true } }, width: { control: { type: 'range', min: 320, max: 520, step: 10 } } },
  render: args => <Preview key={args.mode} {...args} />,
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Weekly: Story = { name: '기록 · 주간' };
export const Monthly: Story = { name: '기록 · 월간', args: { mode: 'month' } };
export const Calendar: Story = { name: '달력', args: { mode: 'calendar' } };
export const Profile: Story = { name: '마이페이지', args: { mode: 'profile' } };
