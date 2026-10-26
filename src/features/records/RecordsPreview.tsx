import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, InfoButton, SegmentedControl } from '../../design/components';
import { colors, spacing, typography } from '../../design/theme';
import { DayDetail, MonthlyCalendar, PeriodHeader, RecordLegend, WeeklyChart } from './RecordComponents';
import { achieved, duration, monthStart, parseDate, previewRecord, previewToday, shiftDate, shiftMonth, weekStart } from './model';

export type RecordsPreviewProps = { initialPeriod?: 'week' | 'month'; initialDate?: string; empty?: boolean; profile?: { id: string; name: string; goal: number | null; todayMinutes: number }; onBack?(): void; records?: import('./model').StudyRecord[]; today?: string; onRangeChange?(from: string, to: string): void; refreshControl?: React.ReactElement; notice?: React.ReactNode; loading?: boolean; renderDayDetail?(day: import('./model').StudyRecord): React.ReactNode };
export function RecordsPreview({ initialPeriod = 'week', initialDate = '2026-10-16', empty = false, profile, onBack, records, today = previewToday, onRangeChange, refreshControl, notice, loading = false, renderDayDetail }: RecordsPreviewProps) {
  const [legendOpen, setLegendOpen] = useState(false);
  const [period, setPeriod] = useState(initialPeriod);
  const [selected, setSelected] = useState(initialDate);
  const start = period === 'week' ? weekStart(selected) : monthStart(selected);
  const count = period === 'week' ? 7 : parseDate(shiftMonth(start, 1)).getTime() / 86400000 - parseDate(start).getTime() / 86400000;
  const record = (date: string) => records ? records.find(day => day.date === date) ?? { date, minutes: 0, goal: null, status: 'empty' as const, sessions: [] } : previewRecord(date, profile, empty);
  const days = Array.from({ length: count }, (_, i) => record(shiftDate(start, i)));
  const elapsed = days.filter(day => day.date <= today);
  const minutes = elapsed.reduce((sum, day) => sum + day.minutes, 0);
  const day = record(selected);
  const date = parseDate(start);
  const next = period === 'week' ? shiftDate(start, 7) : shiftMonth(start, 1);
  const earliest = onRangeChange ? undefined : records?.reduce<string | undefined>((first, day) => !first || day.date < first ? day.date : first, undefined);
  const end = shiftDate(start, count - 1) > today ? today : shiftDate(start, count - 1);
  useEffect(() => { onRangeChange?.(start, end); }, [start, end, onRangeChange]);
  const move = (direction: number) => { const target = period === 'week' ? shiftDate(start, direction * 7) : shiftMonth(start, direction); setSelected(target > today ? today : earliest && target < earliest ? earliest : target); };
  const selectDay = (value: string) => { if (!loading && value <= today && (!earliest || value >= earliest)) { setSelected(value); } };
  return <View style={{ flex: 1 }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
    <View style={s.header}>{onBack && <Button label="←" variant="ghost" size="icon" accessibilityLabel="친구 목록으로 돌아가기" onPress={onBack} />}<Text accessibilityRole="header" numberOfLines={2} style={[profile ? typography.title : typography.heading, s.heading]}>{profile ? `${profile.name}의 기록` : '기록'}</Text><View style={s.switch}><SegmentedControl<'week' | 'month'> variant="soft" accessibilityLabel="기록 기간" value={period} onChange={setPeriod} options={[{ value: 'week', label: '주간' }, { value: 'month', label: '월간' }]} /></View></View>
    <PeriodHeader previousDisabled={!!earliest && start <= earliest} compact title={period === 'week' ? `${date.getUTCMonth() + 1}월 ${Math.ceil((date.getUTCDate() + ((parseDate(monthStart(start)).getUTCDay() + 6) % 7)) / 7)}주차` : `${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월`} onPrevious={() => move(-1)} onNext={() => move(1)} nextDisabled={next > today} />
    {notice}
    <View style={s.metrics}><View style={s.metricItem}><Text style={s.metricLabel}>총 공부 시간</Text><Text style={s.metricValue}>{loading ? '—' : duration(minutes)}</Text></View><View style={s.metricDivider} /><View style={s.metricItem}><Text style={s.metricLabel}>목표 달성</Text><Text style={[s.metricValue, { color: colors.primary }]}>{loading ? '—' : `${elapsed.filter(achieved).length}일`}</Text></View></View>
    {period === 'week' ? <WeeklyChart today={today} days={days} selected={selected} onSelect={selectDay} /> : <MonthlyCalendar compact days={days} selected={selected} onSelect={selectDay} today={today} />}
    <View style={s.legendRow}><Text style={s.hint}>날짜를 누르면 아래에서 상세 기록을 볼 수 있어요</Text><InfoButton accessibilityLabel="기록 표시 안내" onPress={() => setLegendOpen(true)} /></View>
    {!loading && <View style={s.detail}>
      <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>상세 기록</Text>
      {renderDayDetail ? renderDayDetail(day) : <DayDetail day={day} aggregateOnly={!!records} />}
    </View>}
    </ScrollView>
    <Modal visible={legendOpen} transparent animationType="slide" onRequestClose={() => setLegendOpen(false)}>
      <View style={s.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="기록 표시 안내 닫기" onPress={() => setLegendOpen(false)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal role="dialog" aria-modal={true} accessibilityLabel="기록 표시 안내" style={s.sheet}>
          <View style={s.sheetHeader}><Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>기록 표시 안내</Text><Button label="닫기" variant="ghost" size="compact" onPress={() => setLegendOpen(false)} /></View>
          <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}><View style={{ gap: spacing.lg }}><RecordLegend /><Text style={s.summary}>연한 초록 배경은 공부한 날, 수박은 목표를 달성한 날이에요. 사선 무늬는 쉬는 날, 비행기는 연차를 사용한 날이에요.</Text></View></ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}
const s = StyleSheet.create({
  content: { paddingHorizontal: spacing.xxl, paddingTop: spacing.sm, gap: spacing.sm, paddingBottom: spacing.xxl },
  detail: { gap: spacing.md, paddingTop: spacing.lg },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heading: { flex: 1, color: colors.text }, switch: { width: 136, flexShrink: 0 },
  metrics: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.sm },
  metricItem: { flex: 1, gap: spacing.xs },
  metricLabel: { ...typography.caption, color: colors.secondary },
  metricValue: { ...typography.title, lineHeight: 28, color: colors.text, fontVariant: ['tabular-nums'] },
  metricDivider: { width: 1, height: 36, backgroundColor: colors.track },
  summary: { ...typography.secondary, color: colors.secondary },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  hint: { ...typography.caption, color: colors.secondary, flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(37,45,40,0.3)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 480, maxHeight: '75%', backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.xxl, paddingBottom: spacing.xxxl, gap: spacing.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
});
