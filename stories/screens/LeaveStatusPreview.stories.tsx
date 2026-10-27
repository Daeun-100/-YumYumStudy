import { useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Button, Card } from '../../src/design/components';
import { MonthlyCalendar, PeriodHeader } from '../../src/features/records/RecordComponents';
import { monthStart, parseDate, shiftDate, shiftMonth } from '../../src/features/records/model';
import { colors, spacing, typography } from '../../src/design/theme';
import { characterArtwork } from '../../src/design/character-artwork';
import { LeaveScheduleList } from '../../src/features/leave/LeaveScheduleList';
import { WeeklyLeaveProgress } from '../../src/features/leave/LeaveView';
import { BottomTabs, StudyLayout } from './StudyLayouts';

const text = { ...typography.secondary, color: colors.secondary };
const title = { ...typography.body, fontWeight: '700' as const, color: colors.text };
type Props = { view: 'compare' | 'home' | 'leave'; todayLeave: boolean; reserved: boolean; width: number; height: number; achieved: boolean };
function LeaveSchedule({ todayLeave, reserved, width, height, onHome }: Props & { onHome?(): void }) {
  const [calendar, setCalendar] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [month, setMonth] = useState('2026-10-01');
  const [usedDate, setUsedDate] = useState<string | null>(todayLeave ? '2026-10-27' : null);
  const [reservedDate, setReservedDate] = useState<string | null>(reserved ? '2026-10-30' : null);
  const openCalendar = (date: string | null) => { setSelected(date); setMonth(monthStart(date ?? '2026-10-27')); setCalendar(true); };
  const today = '2026-10-27';
  const days = Array.from({ length: parseDate(shiftDate(shiftMonth(month, 1), -1)).getUTCDate() }, (_, i) => {
    const date = shiftDate(month, i);
    return { date, minutes: 0, goal: 180, status: date === usedDate || date === reservedDate ? 'leave' as const : 'empty' as const, sessions: [] };
  });
  return <View style={{ width, maxWidth: '100%', height, borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
    <View style={{ height: 44, paddingHorizontal: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={title}>9:41</Text><Text style={text}>● ● ▰</Text></View>
    <View style={{ minHeight: 68, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }}>{calendar && <Button label="←" variant="ghost" size="icon" accessibilityLabel="연차 메인으로 돌아가기" onPress={() => setCalendar(false)} />}<Text accessibilityRole="header" style={{ ...typography.heading, color: colors.text }}>{calendar ? '연차 달력' : '연차'}</Text></View>
    {calendar ? <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 20 }}><Text style={title}>사용 가능 2개</Text><PeriodHeader title={month.slice(0,7).replace('-', '년 ') + '월'} onPrevious={() => {setMonth(shiftMonth(month,-1));setSelected(null);}} onNext={() => {setMonth(shiftMonth(month,1));setSelected(null);}} /><MonthlyCalendar days={days} today={today} selected={selected ?? ''} onSelect={setSelected} allowFutureSelection variant="leave" /><Text style={title}>{selected ? selected.replaceAll('-', '.') : '날짜를 선택해 주세요'}</Text>{selected && selected === usedDate ? <><Text style={{ ...text, color: colors.leave }}>사용 완료 · 다음 날 오전 6시까지</Text><Text style={text}>이미 사용한 연차는 취소하거나 날짜를 변경할 수 없어요.</Text></> : selected && selected === reservedDate ? <><Text style={text}>예약 · 사용일 오전 6시부터 적용</Text><Button label="날짜 변경" onPress={() => setSelected(null)} /><Button label="예약 취소" variant="secondary" onPress={() => setReservedDate(null)} /></> : <><Button label={selected === today ? '오늘 연차 사용' : '연차 예약'} disabled={!selected || selected < today} onPress={() => { if(selected === today) setUsedDate(selected); else if(selected) setReservedDate(selected); }} /><Text style={text}>{selected && selected < today ? '지난 공부 날짜에는 사용할 수 없어요.' : '스토리북 샘플 · 실제 데이터는 변경되지 않아요.'}</Text></>}</ScrollView> : <>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 44, paddingBottom: 24, gap: 24 }}>
      <Card style={{ backgroundColor: colors.soft, padding: 24, gap: 12, overflow: 'visible' }}>
        <View style={{ minHeight: 116, paddingRight: 116, gap: 12 }}><Text style={title}>사용 가능한 연차</Text><Text style={{ fontSize: 56, lineHeight: 64, fontWeight: '800', color: colors.primaryPressed }}>2<Text style={{ fontSize: 26 }}> 개</Text></Text></View>
        <Image source={characterArtwork.bunny.leave} resizeMode="contain" accessibilityLabel="휴가를 즐기는 토끼" style={{ position: 'absolute', width: 232, height: 232, right: -34, top: -56 }} />
        <View style={{ minHeight: 44, justifyContent: 'center', borderTopWidth: 1, borderColor: colors.border }}><Text style={text}>가장 빠른 만료 · 11월 2일 오전 6시</Text></View>
      </Card>
      <WeeklyLeaveProgress days={4} />
      <LeaveScheduleList today={today} onSelect={openCalendar} items={[
        ...(usedDate ? [{ id: 'today', date: usedDate, state: 'used' as const }] : []),
        ...(reservedDate ? [{ id: 'future', date: reservedDate, state: 'scheduled' as const }] : []),
      ]} />
    </ScrollView>
    <View style={{ padding: 24, paddingTop: 8 }}><Button label="연차 사용하기" onPress={() => openCalendar(null)} /></View>
    </>}
    <BottomTabs selected="연차" onSelect={label => { if (label === '홈') onHome?.(); }} />
  </View>;
}
function Preview(props: Props) {
  const [active, setActive] = useState<'home' | 'leave'>(props.view === 'leave' ? 'leave' : 'home');
  const home = <StudyLayout screen="home" homeEntryPreview onOpenLeave={() => setActive('leave')} todayLeave={props.todayLeave} running={false} seconds={props.achieved ? 10800 : 4815} width={props.width} height={props.height} />;
  if (props.view !== 'compare') return active === 'home' ? home : <LeaveSchedule {...props} onHome={() => setActive('home')} />;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xxl }}>
    <View style={{ gap: 12, maxWidth: '100%' }}><Text style={title}>평소 홈</Text><StudyLayout screen="home" homeEntryPreview running={false} seconds={props.achieved ? 10800 : 4815} width={props.width} height={props.height} /></View>
    <View style={{ gap: 12, maxWidth: '100%' }}><Text style={title}>연차인 날 · 같은 높이의 목표 줄</Text>{active === 'home' ? home : <LeaveSchedule {...props} onHome={() => setActive('home')} />}</View>
    <View style={{ gap: 12, maxWidth: '100%' }}><Text style={title}>연차 일정 · 오늘과 예약 통합</Text><LeaveSchedule {...props} /></View>
  </View>;
}
const meta = {
  title: '화면 시안/연차 상태 개선', component: Preview,
  parameters: { screenLayout: true, layout: 'fullscreen', docs: { description: { component: '목표 줄을 연차 상태로 전환하고 오늘·미래 일정을 하나로 묶는 검토용 시안입니다. 홈의 오늘 연차는 연차 탭으로, 일정 행은 해당 날짜가 선택된 달력으로 이동합니다. 서버와 연결하지 않습니다.' } } },
  args: { view: 'compare', todayLeave: true, reserved: true, width: 390, height: 844, achieved: false },
  argTypes: { view: { control: 'select', options: ['compare', 'home', 'leave'] } },
  render: args => <Preview key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Compare: Story = { name: '홈·연차 나란히 비교' };
export const Home: Story = { name: '홈 · 오늘 연차', args: { view: 'home' } };
export const HomeAchieved: Story = { name: '홈 · 연차와 실제 목표 달성', args: { view: 'home', achieved: true } };
export const Schedule: Story = { name: '연차 · 오늘과 미래 예약', args: { view: 'leave' } };
export const TodayOnly: Story = { name: '연차 · 오늘만 사용', args: { view: 'leave', reserved: false } };
export const FutureOnly: Story = { name: '연차 · 미래 예약만', args: { view: 'leave', todayLeave: false } };
export const Empty: Story = { name: '연차 · 일정 없음', args: { view: 'leave', todayLeave: false, reserved: false } };
export const Small: Story = { name: '320px · 나란히 비교', args: { width: 320, height: 640 } };
