import { memo } from 'react';
import { AchievementProgressIcon } from '../../design/AchievementProgressIcon';
import { watermelonGoalPercent } from '../../design/watermelon-fill';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AchievementBadge, AchievementIcon, Card } from '../../design/components';
import { colors, radius, spacing, typography } from '../../design/theme';
import { achieved, duration, recordedDuration, parseDate, previewToday, type RecordSession, type StudyRecord } from './model';

export function PeriodHeader({ title, subtitle, onPrevious, onNext, nextDisabled = false, previousDisabled = false, compact = false }: { previousDisabled?: boolean; compact?: boolean; title: string; subtitle?: string; onPrevious(): void; onNext(): void; nextDisabled?: boolean }) {
  return <View style={[s.period, compact && { paddingTop: 0, paddingBottom: 0, gap: 0 }]}>
    <View style={s.periodControls}>
      <Pressable accessibilityRole="button" accessibilityLabel="이전 기간" disabled={previousDisabled} accessibilityState={{ disabled: previousDisabled }} onPress={onPrevious} style={({ pressed }) => [s.periodArrow, pressed && { backgroundColor: colors.surfacePressed }]}><Text style={s.periodChevron}>‹</Text></Pressable>
      <Text style={s.periodTitle}>{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="다음 기간" accessibilityState={{ disabled: nextDisabled }} disabled={nextDisabled} onPress={onNext} style={({ pressed }) => [s.periodArrow, pressed && { backgroundColor: colors.surfacePressed }]}><Text style={[s.periodChevron, nextDisabled && { color: colors.inactiveLabel }]}>›</Text></Pressable>
    </View>
    {subtitle && <Text style={s.secondary}>{subtitle}</Text>}
  </View>;
}
export function GoalProgress({ minutes, goal }: { minutes: number; goal: number | null }) {
  const percent = goal !== null && goal > 0 ? Math.floor(minutes / goal * 100) : null;
  return <View style={{ gap: spacing.xs }}><View accessibilityRole="progressbar" accessibilityLabel="목표 진행률" accessibilityValue={percent === null ? { text: '목표 없음' } : { min: 0, max: 100, now: Math.min(100, percent), text: `${percent}%` }} style={s.track}><View style={[s.fill, { width: `${Math.min(100, percent ?? 0)}%` }]} /></View><View style={s.between}><Text style={s.secondary}>{goal === null ? '목표 미설정' : goal === 0 ? '쉬는 날' : `목표 ${duration(goal)}`}</Text>{percent !== null && <Text style={s.secondary}>{percent}%</Text>}</View></View>;
}
export function RecordMark({ kind }: { kind: 'achieved' | StudyRecord['status'] }) {
  if (kind === 'achieved') return <AchievementIcon size={18} />;
  if (kind === 'leave') return <View accessible accessibilityLabel="연차" style={{ width: 20, height: 20, borderRadius: radius.pill, backgroundColor: colors.leaveIconBackground, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 14, lineHeight: 18, color: colors.leave }}>✈</Text></View>;
  if (kind === 'rest') return <Text style={{ fontSize: 15, color: colors.inactive }}>／</Text>;
  return <View style={[s.dot, { backgroundColor: kind === 'study' ? colors.study : colors.track }]} />;
}
export function RecordDayMark({ day, superWatermelon = false }: { day: StudyRecord; superWatermelon?: boolean }) {
  if (superWatermelon && day.status !== 'leave' && achieved(day)) return <AchievementIcon size={18} superWatermelon />;
  const percent = day.status === 'leave' || day.status === 'rest' ? null : watermelonGoalPercent(day.minutes * 60, day.goal);
  return percent !== null && percent > 0 ? <AchievementProgressIcon percent={percent} /> : <RecordMark kind={achieved(day) ? 'achieved' : day.status} />;
}
export function RecordLegend() { return <View style={s.legend}>{([['achieved', '목표 달성'], ['study', '공부함'], ['empty', '기록 없음'], ['rest', '쉬는 날'], ['leave', '연차']] as const).map(([kind, label]) => <View key={kind} style={s.legendItem}><RecordMark kind={kind} /><Text style={s.caption}>{label}</Text></View>)}</View>; }
const dayLabel = (day: StudyRecord, compact = false) => `${day.date}, ${compact ? duration(day.minutes) : recordedDuration(day.minutes)}, ${day.goal === null ? '목표 미설정' : `목표 ${duration(day.goal)}`}, ${achieved(day) ? '목표 달성' : day.status === 'rest' ? '쉬는 날' : day.status === 'leave' ? '연차' : day.status === 'empty' ? '기록 없음' : '공부함'}`;
export function WeeklyChart({ days, selected, onSelect, today = previewToday, superWatermelonDates = [] }: { superWatermelonDates?: readonly string[]; days: StudyRecord[]; selected: string; onSelect(date: string): void; today?: string }) {
  const ceiling = Math.max(360, Math.ceil(Math.max(...days.map(day => Math.max(day.status === 'leave' ? 0 : day.goal ?? 0, day.minutes))) / 120) * 120);
  return <View style={{ gap: spacing.sm }}><View style={[s.legend, { justifyContent: 'flex-end' }]}><View style={s.legendItem}><View style={[s.dot, { backgroundColor: colors.goal }]} /><Text style={s.caption}>목표 시간</Text></View><View style={s.legendItem}><View style={[s.dot, { backgroundColor: colors.primary }]} /><Text style={s.caption}>실제 공부 시간</Text></View></View><View style={s.chart}>
    <View style={s.axis}>{[ceiling, ceiling * 2 / 3, ceiling / 3, 0].map(value => <Text key={value} style={s.caption}>{Math.round(value / 60)}h</Text>)}</View>
    {days.map(day => <Pressable key={day.date} accessibilityRole="button" accessibilityState={{ selected: day.date === selected, disabled: day.date > today }} disabled={day.date > today} accessibilityLabel={dayLabel(day)} onPress={() => onSelect(day.date)} style={s.column}><View style={s.barArea}>{day.status !== 'leave' && <View style={[s.bar, { height: `${(day.goal ?? 0) / ceiling * 100}%`, backgroundColor: colors.goal }]} />}<View style={[s.bar, { height: `${day.minutes / ceiling * 100}%`, backgroundColor: colors.primary }]} /></View><View style={[s.daySelection, day.date === selected && { backgroundColor: day.status === 'leave' ? colors.leaveBackground : colors.soft }]}><Text style={[s.label, day.date === today && { fontWeight: '800', color: colors.primary }]}>{['일', '월', '화', '수', '목', '금', '토'][parseDate(day.date).getUTCDay()]}</Text><View style={{ alignItems: 'center', gap: 2 }}><Text style={[s.caption, day.date === today && { fontWeight: '800', color: colors.primary }]}>{parseDate(day.date).getUTCDate()}</Text></View><View style={s.weeklyMark}><RecordDayMark day={day} superWatermelon={superWatermelonDates.includes(day.date)} /></View></View></Pressable>)}
  </View></View>;
}
export function MonthlyCalendar({ days, selected, onSelect, today, allowFutureSelection = false, variant = 'records', compact = false, superWatermelonDates = [] }: { superWatermelonDates?: readonly string[]; compact?: boolean; days: StudyRecord[]; selected: string; onSelect(date: string): void; today: string; allowFutureSelection?: boolean; variant?: 'records' | 'leave' }) {
  const offset = days.length ? parseDate(days[0].date).getUTCDay() : 0;
  const CalendarContainer = View;
  return <CalendarContainer style={variant === 'leave' ? s.leaveCalendar : undefined}><View style={s.grid}>{['일', '월', '화', '수', '목', '금', '토'].map(label => <Text key={label} style={[s.caption, s.weekday]}>{label}</Text>)}{Array.from({ length: offset }, (_, i) => <View key={`blank${i}`} style={s.cellSlot} />)}{days.map(day => {
    const isToday = day.date === today;
    const isLeave = day.status === 'leave';
    const isRest = day.status === 'rest';
    const disabled = !allowFutureSelection && day.date > today;
    const status = isLeave ? day.date > today ? '연차 예약' : '연차 사용 완료' : isRest ? '쉬는 날' : '';
    const label = variant === 'leave' ? `${day.date}${isToday ? ', 오늘' : ''}${status ? `, ${status}` : ''}` : `${dayLabel(day, true)}${isToday ? ', 오늘' : ''}`;
    const backgroundColor = isRest ? colors.restBackground : variant === 'records' ? day.minutes > 0 || day.date === selected ? colors.soft : 'transparent' : isLeave ? colors.leaveBackground : 'transparent';
    const description = variant === 'leave' ? '' : day.date > today ? '' : day.minutes ? duration(day.minutes).replace(' ', '\n') : isRest || isLeave ? '' : '—';
    return <View key={day.date} style={s.cellSlot}><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: day.date === selected, disabled }} disabled={disabled} onPress={() => onSelect(day.date)} style={({ pressed }) => [s.cell, (variant === 'leave' || compact) && s.leaveCell, variant === 'records' && s.recordCell, { backgroundColor: pressed ? colors.surfacePressed : variant === 'leave' && day.date === selected && !isLeave && !isRest ? colors.soft : backgroundColor, borderColor: day.date === selected ? colors.primary : 'transparent' }]}>
      {isRest && <View pointerEvents="none" accessible={false} accessibilityElementsHidden style={StyleSheet.absoluteFill}>{Array.from({ length: 23 }, (_, i) => <View key={i} style={{ position: 'absolute', left: -80, top: i * 12 - 90, width: 240, height: 2, backgroundColor: colors.restStripe, transform: [{ rotate: '-45deg' }] }} />)}</View>}
      <View style={{ alignItems: 'center', gap: 2 }}><Text style={[s.label, isToday && { fontWeight: '800', color: colors.primary }, disabled && { color: colors.disabledText }]}>{parseDate(day.date).getUTCDate()}</Text>{isToday && <View style={{ width: 4, height: 4, borderRadius: radius.pill, backgroundColor: colors.primary }} />}</View>
      <Text style={s.cellTime}>{description}</Text>
      {isLeave ? <RecordMark kind="leave" /> : variant === 'leave' || isRest ? <View style={{ height: 20 }} /> : day.date <= today && <RecordDayMark day={day} superWatermelon={superWatermelonDates.includes(day.date)} />}
    </Pressable></View>;
  })}</View></CalendarContainer>;
}
export const SessionRow = memo(function SessionRow({ session }: { session: RecordSession }) { return <View style={s.session}><Text style={[s.secondary, { color: colors.text, flex: 1 }]}>{session.start.length === 5 ? `${session.start}:00` : session.start} – {session.end.length === 5 ? `${session.end}:00` : session.end}</Text><Text style={s.caption}>{recordedDuration(session.minutes)}</Text></View>; });
export function DayDetail({ day, aggregateOnly = false, superWatermelon = false }: { day: StudyRecord; aggregateOnly?: boolean; superWatermelon?: boolean }) {
  const date = parseDate(day.date);
  return <Card style={s.dayDetail}><Text accessibilityRole="header" style={s.title}>{date.getUTCMonth() + 1}월 {date.getUTCDate()}일 ({['일', '월', '화', '수', '목', '금', '토'][date.getUTCDay()]})</Text><View style={s.detailTimeRow}><Text numberOfLines={1} adjustsFontSizeToFit style={[s.metric, { flexShrink: 1, minWidth: 0 }]}>{recordedDuration(day.minutes)}</Text>{achieved(day) && <AchievementBadge superWatermelon={superWatermelon} />}{(day.status === 'rest' || day.status === 'leave') && <View style={[s.legendItem, { padding: spacing.sm, borderRadius: radius.pill, backgroundColor: day.status === 'leave' ? colors.leaveBackground : colors.restBackground }]}><RecordMark kind={day.status} /><Text style={[s.caption, { color: day.status === 'leave' ? colors.leave : colors.secondary }]}>{day.status === 'leave' ? '연차 사용' : '쉬는 날'}</Text></View>}</View>{day.status === 'leave' ? <Text style={s.secondary}>목표 면제 · 기존 목표 {day.goal === null ? '미설정' : duration(day.goal)}</Text> : <GoalProgress minutes={day.minutes} goal={day.goal} />}{aggregateOnly ? <Text style={s.secondary}>하루 합산 공부 시간이에요.</Text> : <><View style={s.divider} /><View style={s.legendItem}><Text style={s.title}>공부 기록</Text><Text style={s.count}>{day.sessions.length}</Text></View><View style={s.sessionArea}>{day.sessions.length ? <View>{day.sessions.map(session => <SessionRow key={session.start} session={session} />)}</View> : <Text style={[s.secondary, { textAlign: 'center' }]}>공부 기록 없음</Text>}</View></>}</Card>;
}
const s = StyleSheet.create({
  period: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.xs, paddingBottom: spacing.lg },
  periodControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg, width: '100%' },
  periodArrow: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  periodChevron: { fontSize: 22, color: colors.text },
  periodTitle: { ...typography.body, fontWeight: '700', color: colors.text, textAlign: 'center', flexShrink: 1 }, between: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.body, fontWeight: '700', color: colors.text }, secondary: { ...typography.secondary, color: colors.secondary }, caption: { ...typography.caption, color: colors.secondary }, label: { ...typography.label, color: colors.text }, metric: { ...typography.heading, fontSize: 27, lineHeight: 36, color: colors.text, fontVariant: ['tabular-nums'] },
  detailTimeRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  sessionArea: { minHeight: 56, justifyContent: 'center' },
  dayDetail: { gap: spacing.md, padding: spacing.xl, borderRadius: 22 },
  track: { height: 6, backgroundColor: colors.track, borderRadius: radius.pill, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
  dot: { width: 11, height: 11, borderRadius: radius.pill }, legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  chart: { flexDirection: 'row', gap: 2, paddingTop: spacing.lg }, axis: { height: 170, justifyContent: 'space-between', width: 24 }, column: { flex: 1, minHeight: 250, paddingVertical: spacing.xs, borderRadius: 14, alignItems: 'center', gap: spacing.xs }, barArea: { height: 170, width: '100%', alignItems: 'center', justifyContent: 'flex-end', marginBottom: spacing.sm }, bar: { position: 'absolute', bottom: 0, width: '65%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  weeklyMark: { height: 20, alignItems: 'center', justifyContent: 'center' },
  daySelection: { alignSelf: 'stretch', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: 14 },
  recordCell: { height: 76 },
  leaveCalendar: { gap: spacing.md }, leaveCell: { minHeight: 60, borderRadius: 10 },
  calendarCard: { padding: spacing.xs, borderRadius: 20 }, grid: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { width: '14.285714%', textAlign: 'center', paddingVertical: spacing.sm }, cellSlot: { width: '14.285714%', padding: 2 }, cell: { overflow: 'hidden', minHeight: 76, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs, paddingHorizontal: 1 }, cellTime: { ...typography.small, fontSize: 10, lineHeight: 13, textAlign: 'center', color: colors.text },
  session: { paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }, divider: { height: 1, backgroundColor: colors.border }, count: { ...typography.caption, backgroundColor: colors.emptyBackground, paddingHorizontal: spacing.sm, borderRadius: radius.pill, color: colors.secondary },
});
