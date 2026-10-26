import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, SegmentedControl } from '../../design/components';
import { colors, layout, spacing, typography } from '../../design/theme';
import type { GoalWeek } from '../../lib/contracts';
import { SettingsRow, InfoNotice } from '../profile/ProfileComponents';
import { TimeWheelPicker } from '../profile/TimeWheelPicker';
import { goalText, sameGoals, weekdays } from './model';

type Props = {
  goals: GoalWeek | null; saved: GoalWeek | null; current?: GoalWeek; loading?: boolean; saving?: boolean;
  error?: string | null; notice?: string | null; effectiveDate?: string | null; status?: ReactNode;
  initialPreview?: boolean; initialDay?: number; embedded?: boolean; discard?: boolean;
  onChange(goals: GoalWeek): void; onSave(): void; onRetry(): void; onBack(): void;
  onKeepEditing(): void; onDiscard(): void;
};
export function GoalsView({ goals, saved, current, loading = false, saving = false, error, notice, effectiveDate, status,
  initialPreview = false, initialDay, embedded = false, discard = false, onChange, onSave, onRetry, onBack, onKeepEditing, onDiscard }: Props) {
  const [preview, setPreview] = useState(initialPreview);
  const [day, setDay] = useState<number | undefined>(initialDay);
  const initialValue = initialDay === undefined ? 120 : goals?.[initialDay];
  const [mode, setMode] = useState<'time' | 'rest'>(initialValue === 0 ? 'rest' : 'time');
  const [time, setTime] = useState(initialValue || 120);
  const [fieldError, setFieldError] = useState('');
  const dirty = !!goals && !!saved && !sameGoals(goals, saved);
  const total = goals?.reduce<number>((sum, value) => sum + (value ?? 0), 0) ?? 0;
  function edit(index: number) {
    if (!goals || saving) return;
    const value = goals[index];
    setMode(value === 0 ? 'rest' : 'time');
    setTime(value || 120); setFieldError(''); setDay(index);
  }
  function confirm() {
    if (!goals || day === undefined) return;
    if (mode === 'time' && (time <= 0 || time > 1440 || !Number.isInteger(time))) { setFieldError('시간을 선택하거나 쉬는 날로 설정해 주세요.'); return; }
    const next = [...goals] as GoalWeek;
    next[day] = mode === 'rest' ? 0 : time;
    onChange(next); setDay(undefined);
  }
  return <View style={{ flex: 1 }}>
    <View style={s.header}><Button label="←" size="icon" variant="ghost" accessibilityLabel="이전 화면으로 돌아가기" disabled={saving} onPress={onBack} /><Text accessibilityRole="header" style={s.heading}>공부 목표 설정</Text></View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {status}
      {loading && !goals && <ActivityIndicator color={colors.primary} accessibilityLabel="목표 불러오는 중" />}
      {!!error && <View style={{ gap: spacing.sm }}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button label="다시 불러오기" variant="secondary" disabled={saving || loading} onPress={onRetry} /></View>}
      {goals && <>
        <SegmentedControl accessibilityLabel="목표 설정 보기" value={preview ? 'preview' : 'days'} onChange={value => setPreview(value === 'preview')} options={[{ value: 'days', label: '요일별 설정' }, { value: 'preview', label: '미리보기' }]} />
        <Text style={s.caption}>{preview ? '일주일의 공부와 휴식, 균형을 살펴보세요.' : '요일별로 공부와 휴식의 리듬을 정해보세요.'}</Text>
        {preview ? <View style={s.openSection}>
          <Text style={s.label}>일주일 목표</Text><Text style={s.metric}>{total ? goalText(total) : goals.every(value => value === 0) ? '이번 주는 쉬어가요' : '목표 미설정'}</Text>
          <Text style={s.caption}>공부 {goals.filter(value => value !== null && value > 0).length}일 · 휴무 {goals.filter(value => value === 0).length}일</Text>
          {weekdays.map((label, index) => <View key={label} style={s.chartRow}><Text style={s.caption}>{label.slice(0, 1)}</Text><View style={s.track}><View style={{ height: '100%', width: `${(goals[index] ?? 0) / Math.max(...goals.map(value => value ?? 0), 60) * 100}%`, backgroundColor: colors.study, borderRadius: 8 }} /></View><Text style={[s.caption, { width: 80, textAlign: 'right' }]}>{goalText(goals[index])}</Text></View>)}
        </View> : <View style={{ gap: spacing.sm }}>{weekdays.map((label, index) => <SettingsRow key={label} label={label} value={goalText(goals[index])} description={current && current[index] !== goals[index] ? `현재 ${goalText(current[index])}` : undefined} selected={goals[index] !== saved?.[index]} onPress={() => edit(index)} />)}</View>}
        <InfoNotice title="변경한 목표는 언제 적용되나요?">다음 공부 날짜 오전 6시부터 적용돼요. 오늘의 목표와 과거 기록은 그대로 유지돼요. 쉬는 날은 연차 획득 일수에 포함되지 않아요.</InfoNotice>
        {!!effectiveDate && <Text style={s.caption}>예약한 목표는 {effectiveDate} 오전 6시부터 적용돼요.</Text>}
      </>}
    </ScrollView>
    <View style={s.footer}>{!!notice && <Text accessibilityLiveRegion="polite" style={[s.caption, { color: colors.primary }]}>{notice}</Text>}<Button label="저장하기" disabled={!dirty || saving} loading={saving} onPress={onSave} /></View>
    <GoalOverlay visible={day !== undefined} embedded={embedded} onClose={() => setDay(undefined)}>
      <View style={s.overlay}><SafeAreaView edges={['bottom']} style={s.sheet}>
        <View style={s.sheetHeader}><Text accessibilityRole="header" style={[s.title, { flex: 1 }]}>{day === undefined ? '' : weekdays[day]} 목표 시간</Text><Button label="×" accessibilityLabel="목표 시간 설정 닫기" size="icon" variant="raised" onPress={() => setDay(undefined)} /></View>
        <ScrollView contentContainerStyle={{ gap: spacing.xl }} keyboardShouldPersistTaps="handled">
          {mode === 'time' && <TimeWheelPicker value={time} onChange={value => { setTime(value); setFieldError(''); }} />}
          <View style={s.restRow}><Text style={s.body}>쉬는 날로 설정</Text><Switch accessibilityLabel="쉬는 날로 설정" value={mode === 'rest'} onValueChange={value => { setMode(value ? 'rest' : 'time'); setFieldError(''); }} trackColor={{ false: colors.track, true: colors.primary }} /></View>
          <Text style={s.caption}>{mode === 'rest' ? '목표 달성과 연차 획득 일수에서 제외돼요.' : '위아래로 스크롤해서 시간을 선택해요.'}</Text>
          {!!fieldError && <Text accessibilityRole="alert" style={s.error}>{fieldError}</Text>}<Button label="확인" onPress={confirm} />
        </ScrollView>
      </SafeAreaView></View>
    </GoalOverlay>
    <GoalOverlay visible={discard} embedded={embedded} onClose={onKeepEditing}>
      <View style={s.overlay}><View style={[s.sheet, { margin: spacing.xl }]}>
        <Text accessibilityRole="header" style={s.title}>변경한 목표를 나중에 설정할까요?</Text><Text style={s.body}>아직 저장하지 않은 변경사항이 있어요.</Text>
        <Button label="계속 설정하기" onPress={onKeepEditing} /><Button label="변경사항 버리고 나가기" variant="secondary" onPress={onDiscard} />
      </View></View>
    </GoalOverlay>
  </View>;
}
function GoalOverlay({ visible, embedded, onClose, children }: { visible: boolean; embedded: boolean; onClose(): void; children: ReactNode }) {
  if (embedded) return visible ? <View accessibilityViewIsModal style={StyleSheet.absoluteFill}>{children}</View> : null;
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>{children}</Modal>;
}
const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, minHeight: 68 },
  heading: { ...typography.heading, color: colors.text, flex: 1 }, title: { ...typography.title, color: colors.text },
  content: { paddingHorizontal: spacing.xxl, paddingTop: spacing.lg, gap: spacing.lg, paddingBottom: 32 },
  openSection: { gap: spacing.lg, paddingVertical: spacing.lg }, label: { ...typography.body, fontWeight: '600', color: colors.text },
  body: { ...typography.body, color: colors.secondary }, caption: { ...typography.secondary, color: colors.secondary },
  metric: { ...typography.heading, color: colors.primary }, chartRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', minHeight: 32 },
  track: { flex: 1, height: 16, backgroundColor: colors.track, borderRadius: 8, overflow: 'hidden' },
  footer: { padding: spacing.xl, gap: spacing.sm, backgroundColor: colors.background },
  overlay: { flex: 1, backgroundColor: colors.canvas, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: layout.maxWidth, maxHeight: '90%', backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.xxl, gap: spacing.xl },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, restRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.lg },
  error: { ...typography.secondary, color: colors.error },
});
