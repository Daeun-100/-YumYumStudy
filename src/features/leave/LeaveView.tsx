import { LeaveScheduleList } from './LeaveScheduleList';
import { Dialog, DialogCloseButton } from '../../design/Dialog';
import { SkeletonRegion } from '../../design/Skeleton';
import { useImperativeHandle, useState, type ReactNode, type Ref } from 'react';
import { leaveBackTarget } from '../navigation/back-policy';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AchievementIcon, Button, Card, InfoButton, InfoIcon } from '../../design/components';
import { colors, interaction, radius, spacing, typography } from '../../design/theme';
import { characterArtwork } from '../../design/character-artwork';
import type { CharacterId } from '../../lib/characters';
import { MonthlyCalendar, PeriodHeader, RecordMark } from '../records/RecordComponents';
import type { StudyRecord } from '../records/model';

type LeaveState = 'available' | 'scheduled' | 'used' | 'expired';
type Screen = 'home' | 'calendar';
type Grant = { id: string; state: LeaveState; earned: string; expires: string; date?: string };
export type LeaveLayoutProps = {
  embedded?: boolean;
  character?: CharacterId;
  initialScreen?: Screen;
  initialDate?: string;
  initialChanging?: boolean;
  state?: 'ready' | 'empty' | 'loading' | 'error';
  weeklyDays?: number | null;
  width?: number;
  height?: number;
  initialConfirmation?: boolean | 'use' | 'change';
};
const stateNames = { available: '사용 가능', scheduled: '사용 예정', used: '사용 완료', expired: '만료' };
const parse = (date: string) => new Date(`${date}T00:00:00Z`);
const nextDate = (date: string) => { const d = parse(date); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const dateText = (date: string, weekday = false) => `${parse(date).getUTCMonth() + 1}월 ${parse(date).getUTCDate()}일${weekday ? ` (${['일', '월', '화', '수', '목', '금', '토'][parse(date).getUTCDay()]})` : ''}`;
const monthShift = (date: string, step: number) => { const value = parse(date); value.setUTCMonth(value.getUTCMonth() + step, 1); return value.toISOString().slice(0, 10); };

export function LeaveBadge({ state, label }: { state: LeaveState; label?: string }) {
  const tone = state === 'available' ? { backgroundColor: colors.soft, color: colors.primary } : state === 'scheduled' ? { backgroundColor: colors.leaveBackground, color: colors.leave } : { backgroundColor: colors.emptyBackground, color: colors.secondary };
  return <View style={[s.badge, { backgroundColor: tone.backgroundColor }]}><Text style={[s.badgeLabel, { color: tone.color }]}>{label ?? stateNames[state]}</Text></View>;
}
export function LeaveIcon({ state, size = 48 }: { state: LeaveState; size?: number }) {
  if (state === 'scheduled') return <View accessible={false} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><View style={{ transform: [{ scale: size / 20 }] }}><RecordMark kind="leave" /></View></View>;
  return <View accessible={false} style={{ width: size, height: size, borderRadius: radius.pill, backgroundColor: state === 'available' ? colors.soft : colors.emptyBackground, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    {state === 'available' ? <View style={{ width: size * .45, height: size * .44, borderWidth: 2, borderColor: colors.primary, borderRadius: 3 }}><View style={{ height: size * .12, borderBottomWidth: 2, borderColor: colors.primary }} />{[.08, .27].map(left => <View key={left} style={{ position: 'absolute', width: 2, height: size * .13, left: size * left, top: -size * .08, backgroundColor: colors.primary, borderRadius: 1 }} />)}</View> : <Text style={{ fontSize: size * .5, color: colors.secondary }}>{state === 'used' ? '✓' : '◷'}</Text>}
  </View>;
}
export function WeeklyLeaveProgress({ days = 4 }: { days?: number }) {
  const count = Math.min(6, Math.max(0, days));
  return <View style={s.progressCard}><View style={s.between}><Text style={[s.cardTitle, { flex: 1 }]}>{count >= 6 ? '이번 주 보상 획득 조건 달성' : '이번 주 보상 인정 일수'}</Text><Text style={s.title}>{count}<Text style={s.secondary}>/6일</Text></Text></View>
    <View accessible accessibilityLabel={`이번 주 연차 획득 조건 ${count}일 달성, 6일 중`} style={s.fruitRow}>{Array.from({ length: 6 }, (_, i) => <View key={i} style={s.fruitSlot}>{i < count ? <AchievementIcon size={32} /> : <View style={s.emptyFruit} />}</View>)}</View>
    <Text style={s.caption}>{count >= 6 ? '이번 주 보상 연차 획득 조건을 달성했어요.' : `${6 - count}일 더 달성하면 보상 연차 1개를 받아요. 연차 사용일은 제외돼요.`}</Text>
  </View>;
}
export function LeaveInfo({ children }: { children: string }) {
  return <View style={s.info}><InfoIcon /><Text style={[s.secondary, { flex: 1 }]}>{children}</Text></View>;
}
export type LeaveViewProps = LeaveLayoutProps & {
  backRef?: Ref<{ back(): boolean }>;
  backBlocked?: boolean;
  grants: Grant[]; today: string; busy?: boolean; error?: string | null; notice?: string;
  calendarDays: StudyRecord[]; calendarLoading?: boolean; weeklyLoading?: boolean;
  navigation: ReactNode; onClearNotice(): void; onRefresh(): Promise<void>; onMonthChange(month: string): void;
  unavailable(date: string, changingId: string | null): string | null;
  onApply(date: string, changingId: string | null): Promise<boolean>;
  onCancel(id: string, date: string): Promise<boolean>;
};
export function LeaveView({ embedded = false, character = 'bunny', initialScreen = 'home', initialDate, initialChanging = false, state = 'ready', weeklyDays = 0, initialConfirmation = false,
  grants, today, busy = false, error, notice = '', calendarDays, calendarLoading = false, weeklyLoading = false, navigation, onClearNotice, onRefresh, onMonthChange, unavailable, onApply, onCancel, backRef, backBlocked = false }: LeaveViewProps) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [month, setMonth] = useState(`${(initialDate ?? today).slice(0, 7)}-01`);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate ?? null);
  const [changingId, setChangingId] = useState<string | null>(initialChanging ? 'c' : null);
  const [confirmation, setConfirmation] = useState<false | 'cancel' | 'use' | 'change'>(initialConfirmation === true ? 'cancel' : initialConfirmation || false);
  const [confirmedDay, setConfirmedDay] = useState(today);
  const [refreshing, setRefreshing] = useState(false);
  const [details, setDetails] = useState<'rules' | null>(null);
  const loadState = state;
  const refresh = async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } };
  const ready = loadState === 'ready' || loadState === 'empty';
  const available = grants.filter(g => g.state === 'available').sort((a, b) => a.expires.localeCompare(b.expires));
  const scheduleItems = grants.flatMap(g => g.date && (g.state === 'scheduled' || g.state === 'used') ? [{ id: g.id, date: g.date, state: g.state }] : []);
  const expiryGroups = available.reduce<Record<string, number>>((groups, grant) => { groups[grant.expires] = (groups[grant.expires] ?? 0) + 1; return groups; }, {});
  const selectedGrant = grants.find(g => g.date === selectedDate && (g.state === 'scheduled' || g.state === 'used'));
  const changingGrant = grants.find(g => g.id === changingId);
  const confirming = confirmation !== false;
  const dayChanged = confirming && confirmedDay !== today;
  const confirm = (value: 'use' | 'change' | 'cancel') => { setConfirmedDay(today); setConfirmation(value); };
  const overlayOpen = confirming || details !== null;
  const Content = ScrollView;
  const reason = selectedDate ? unavailable(selectedDate, changingId) : null;
  const canApply = !!selectedDate && !reason && (!changingGrant || selectedDate !== changingGrant.date);
  const openCalendar = (date?: string) => { setMonth(`${(date ?? today).slice(0, 7)}-01`); onMonthChange(`${(date ?? today).slice(0, 7)}-01`); setSelectedDate(date ?? null); setChangingId(null); onClearNotice(); setScreen('calendar'); };
  const apply = async () => {
    if (dayChanged) return;
    if (!selectedDate || !canApply || busy) return;
    if (await onApply(selectedDate, changingId)) { setChangingId(null); setConfirmation(false); }

  };
  const cancel = async () => {
    if (dayChanged || !selectedGrant || busy || !selectedDate) return;
    if (await onCancel(selectedGrant.id, selectedDate)) setConfirmation(false);
  };
  const back = () => { setScreen('home'); setChangingId(null); setConfirmation(false); onClearNotice(); };
  useImperativeHandle(backRef, () => ({ back() {
    const target = leaveBackTarget({ confirmation: confirming, details: details !== null, calendar: screen === 'calendar', busy: backBlocked });
    if (target === 'parent') return false;
    if (target === 'details') setDetails(null);
    if (target === 'confirmation') setConfirmation(false);
    if (target === 'home') back();
    return true;
  } }));
  return <View style={{ flex: 1 }}>
    <View style={{ flex: 1 }} aria-hidden={overlayOpen} accessibilityElementsHidden={overlayOpen} importantForAccessibility={overlayOpen ? 'no-hide-descendants' : 'auto'}>
      <View style={[s.header, screen === 'calendar' && { justifyContent: 'flex-start' }]}>{screen === 'calendar' && <Button label="←" variant="ghost" size="icon" accessibilityLabel="연차 메인으로 돌아가기" disabled={backBlocked} onPress={back} />}<Text accessibilityRole="header" style={s.heading}>{screen === 'home' ? '연차' : '연차 달력'}</Text>{screen === 'home' && <InfoButton accessibilityLabel="연차 이용 안내" onPress={() => setDetails('rules')} />}</View>
      <Content key={screen} style={{ flex: 1 }} contentContainerStyle={[s.content, s.calendarContent, screen === 'home' && { paddingTop: 44 }]} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}>
        {!!error && <View style={{ gap: spacing.sm }}><Text accessibilityRole="alert" style={[s.secondary, { color: colors.error }]}>{error}</Text><Button label="다시 불러오기" variant="secondary" disabled={refreshing} onPress={() => void refresh()} /></View>}
        <SkeletonRegion gap={spacing.lg} loading={loadState === 'loading'} label="연차 불러오는 중">{!ready && loadState !== 'loading' ? <View style={s.empty}><Text accessibilityRole="alert" style={s.cardTitle}>연차 정보를 불러오지 못했어요</Text><Text style={s.secondary}>연결을 확인하고 다시 시도해 주세요.</Text><Button label="다시 시도" onPress={() => void refresh()} /></View> : screen === 'home' ? <>
          <Card style={s.balance}>
            <View style={s.balanceSummary}><Text style={s.cardTitle}>사용 가능한 연차</Text><View accessible accessibilityLabel={`${available.length}개`} style={s.balanceValue}><Text style={s.balanceNumber}>{available.length}</Text><Text style={s.balanceUnit}>개</Text></View></View>
            <Image source={characterArtwork[character].leave} resizeMode="contain" accessibilityLabel={`휴가를 즐기는 ${characterArtwork[character].label}`} pointerEvents="none" style={[s.heroArt, ['bunny', 'bear', 'cat', 'puppy'].includes(character) && s.heroArtLarge]} />
            {available.length ? <View style={s.expiryRow}><Text style={s.caption}>가장 빠른 만료 · {dateText(available[0].expires)} 오전 6시</Text></View> : <Text style={s.caption}>매주 무료 연차를 받고, 목표 달성으로 보상 연차도 모아보세요.</Text>}
          </Card>
          <SkeletonRegion loading={weeklyLoading} label="주간 달성 불러오는 중"><WeeklyLeaveProgress days={weeklyDays ?? 0} /></SkeletonRegion>{!weeklyLoading && weeklyDays === null && <Text style={s.secondary}>이번 주 달성 현황을 확인하지 못했어요.</Text>}
          <LeaveScheduleList items={scheduleItems} today={today} onSelect={openCalendar} />
        </> : <>
          <View style={s.calendarBalance}>
            <View style={s.calendarSummary}>
              <Text style={s.availableCount}>사용 가능 {available.length}개</Text>
              {available.length > 0 && <Text style={s.caption}>만료  {Object.keys(expiryGroups).map(expires => `${parse(expires).getUTCMonth() + 1}.${parse(expires).getUTCDate()}`).join(' · ')}  / 오전 6시</Text>}
            </View>
          </View>
          <PeriodHeader title={`${parse(month).getUTCFullYear()}년 ${parse(month).getUTCMonth() + 1}월`} onPrevious={() => { setMonth(monthShift(month, -1)); onMonthChange(monthShift(month, -1)); setSelectedDate(null); onClearNotice(); }} onNext={() => { setMonth(monthShift(month, 1)); onMonthChange(monthShift(month, 1)); setSelectedDate(null); onClearNotice(); }} />
          <SkeletonRegion loading={calendarLoading} label="연차 달력 불러오는 중"><MonthlyCalendar days={calendarDays} selected={selectedDate ?? ''} onSelect={date => { setSelectedDate(date); onClearNotice(); }} today={today} allowFutureSelection variant="leave" /></SkeletonRegion>
          <Text style={s.caption}>만료가 빠른 연차부터 사용해요.</Text>
          <View style={s.dateActions}>
            <View style={[s.between, { minHeight: 32 }]}><Text style={s.cardTitle}>{selectedDate ? dateText(selectedDate, true) : '날짜를 선택해 주세요'}</Text>{selectedGrant && <LeaveBadge state={selectedGrant.state} />}</View>
            {changingGrant ? <><Button label={selectedDate && canApply ? `${dateText(selectedDate)}로 변경` : '날짜 변경'} disabled={!canApply || busy || calendarLoading} onPress={() => confirm('change')} /><Button label="변경 그만두기" variant="secondary" onPress={() => { setSelectedDate(changingGrant.date!); setMonth(`${changingGrant.date!.slice(0, 7)}-01`); onMonthChange(`${changingGrant.date!.slice(0, 7)}-01`); setChangingId(null); }} /></> : selectedGrant?.state === 'scheduled' ? <View style={s.row}><Button label="날짜 변경" disabled={busy} style={{ flex: 1 }} onPress={() => { setChangingId(selectedGrant.id); onClearNotice(); }} /><Button label="예약 취소" disabled={busy} variant="secondary" style={{ flex: 1 }} onPress={() => confirm('cancel')} /></View> : selectedGrant?.state === 'used' ? <><Text style={s.secondary}>사용 완료 · {selectedDate ? dateText(nextDate(selectedDate)) : ''} 오전 6시까지</Text><Text style={s.secondary}>이미 사용한 연차는 취소하거나 날짜를 변경할 수 없어요.</Text></> : <><Button label={selectedDate && canApply ? selectedDate === today ? '오늘 연차 사용' : `${dateText(selectedDate)} 연차 예약` : '연차 사용하기'} disabled={!canApply || busy || calendarLoading} onPress={() => confirm('use')} /></>}
            {selectedDate && reason && !selectedGrant && (!changingGrant || selectedDate !== changingGrant.date) && <Text style={s.secondary}>{reason}</Text>}

          </View>
        </>}</SkeletonRegion>
        {!!notice && <View accessibilityLiveRegion="polite">{screen === 'calendar' ? <Text style={s.calendarNotice}>{notice}</Text> : <LeaveInfo>{notice}</LeaveInfo>}</View>}
        
      </Content>
      {screen === 'home' && <><View style={s.fixedAction}><Button label="연차 사용하기" disabled={!ready || busy} onPress={() => openCalendar()} /></View>{navigation}</>}
    </View>
    <Dialog visible={details !== null} label="연차 이용 안내" embedded={embedded} onClose={() => setDetails(null)}><Card style={{ gap: spacing.lg, maxHeight: '90%' }}><Text accessibilityRole="header" style={s.title}>연차 이용 안내</Text><ScrollView><Text style={s.secondary}>무료 연차는 매주 월요일 오전 6시에 1개 지급되고, 다음 월요일 오전 6시에 만료돼요. 이월되지 않아요. 보상 연차는 한 주에 6일 목표를 달성하면 1개를 받아요. 휴무·미설정·연차 사용일은 달성 일수에서 제외돼요. 보상 연차는 획득 주 시작일로부터 21일 뒤 오전 6시에 만료돼요. 오늘 공부 날짜에는 바로 사용할 수 있고, 사용 후에는 취소하거나 날짜를 변경할 수 없어요. 미래 예약은 사용일 오전 6시 전까지 변경하거나 취소할 수 있어요. 오늘을 제외하면 이미 획득한 보상의 인정 일수가 6일 미만이 되는 경우에는 오늘 연차를 사용할 수 없어요.</Text></ScrollView><DialogCloseButton label="닫기" variant="secondary" /></Card></Dialog>
    <Dialog visible={confirming} label={confirmation === 'cancel' ? '연차 취소 확인' : confirmation === 'change' ? '날짜 변경 확인' : '연차 사용 확인'} busy={backBlocked} embedded={embedded} onClose={() => setConfirmation(false)}><Card style={{ width: '100%', gap: spacing.lg }}>
      <Text accessibilityRole="header" style={s.title}>{confirmation === 'cancel' ? '예약을 취소할까요?' : confirmation === 'change' ? '날짜를 변경할까요?' : selectedDate === today ? '오늘 연차를 사용할까요?' : '연차를 예약할까요?'}</Text>
      <Text style={s.cardTitle}>{confirmation === 'change' && changingGrant ? `${dateText(changingGrant.date!, true)} → ` : ''}{selectedDate ? dateText(selectedDate, true) : ''}</Text>
      {dayChanged && <Text accessibilityRole="alert" style={[s.secondary, { color: colors.error }]}>공부 날짜가 바뀌었어요. 닫고 날짜를 선택한 뒤 다시 확인해 주세요.</Text>}
      {confirmation !== 'cancel' && selectedDate && <><Text style={s.secondary}>{dateText(selectedDate)} 공부 날짜 · {dateText(nextDate(selectedDate))} 오전 6시까지</Text><Text style={s.secondary}>{selectedDate === today ? '오늘 공부 날짜에 바로 적용되며, 사용 후 취소하거나 날짜를 변경할 수 없어요.' : '사용일 오전 6시부터 적용되며, 그 전까지 취소하거나 날짜를 변경할 수 있어요.'}</Text></>}
      {confirmation === 'cancel' && <Text style={s.secondary}>연차 1개가 돌아오며, 만료일은 그대로예요.</Text>}
      {!!error && <Text accessibilityRole="alert" style={[s.secondary, { color: colors.error }]}>{error}</Text>}
      <Button label={confirmation === 'cancel' ? '예약 취소' : confirmation === 'change' ? selectedDate === today ? '오늘로 변경하고 사용' : '변경' : selectedDate === today ? '오늘 사용' : '예약'} loading={busy} disabled={busy || dayChanged || (confirmation !== 'cancel' && !canApply)} onPress={() => void (confirmation === 'cancel' ? cancel() : apply())} />
      <DialogCloseButton label={confirmation === 'cancel' ? '예약 유지' : '닫기'} variant="secondary" disabled={backBlocked} />
    </Card></Dialog>

  </View>;
}
const s = StyleSheet.create({
  phone: { maxWidth: '100%', borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  statusBar: { height: 44, paddingHorizontal: spacing.xxxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, statusTime: { ...typography.label, fontSize: 14, color: colors.text },
  header: { minHeight: 68, paddingHorizontal: spacing.xxl, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'space-between' }, heroArt: { position: 'absolute', width: 184, height: 184, top: -36, right: -16 }, heroArtLarge: { width: 232, height: 232, top: -56, right: -34 }, heroArtCompact: { width: 168, height: 168, top: -36, right: -26 },
  availableCount: { ...typography.body, fontWeight: '700', color: colors.primary },
  calendarBalance: { paddingVertical: spacing.xs, gap: spacing.sm },
  calendarSummary: { alignItems: 'flex-start', gap: spacing.sm },
  calendarContent: { paddingHorizontal: spacing.xxl },
  dateActions: { borderTopWidth: 1, borderColor: colors.track, paddingTop: spacing.xl, gap: spacing.md },
  calendarNotice: { ...typography.secondary, color: colors.primary, paddingVertical: spacing.sm },
  homeContent: { flex: 1, paddingHorizontal: spacing.xxl, gap: spacing.lg },
  expiryRow: { minHeight: interaction.minTouchSize, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderTopWidth: 1, borderColor: colors.border },
  upcoming: { borderTopWidth: 1, borderColor: colors.track, paddingTop: spacing.lg, gap: spacing.sm, minHeight: 92 },
  content: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg, paddingBottom: spacing.xxl },
  heading: { ...typography.heading, color: colors.text }, title: { ...typography.title, color: colors.text }, cardTitle: { ...typography.body, fontWeight: '700', color: colors.text }, body: { ...typography.secondary, color: colors.text }, secondary: { ...typography.secondary, color: colors.secondary }, caption: { ...typography.caption, color: colors.secondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  balance: { position: 'relative', overflow: 'visible', marginTop: spacing.sm, backgroundColor: colors.soft, padding: spacing.xl, gap: spacing.sm },
  balanceSummary: { minHeight: 116, paddingRight: 116, gap: spacing.sm }, balanceSummaryCompact: { minHeight: 100, paddingRight: 96 },
  balanceNumber: { fontSize: 56, lineHeight: 64, fontWeight: '800', color: colors.primaryPressed, letterSpacing: -2 }, balanceUnit: { fontSize: 26, lineHeight: 36, fontWeight: '700', color: colors.primaryPressed, paddingBottom: 4 },
  balanceValue: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  progressCard: { paddingVertical: spacing.sm, gap: spacing.md }, fruitRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs }, fruitSlot: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 36 }, emptyFruit: { width: 28, height: 18, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, backgroundColor: colors.track, transform: [{ rotate: '-25deg' }] },
  badge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill }, badgeLabel: { ...typography.label },
  listRow: { padding: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }, chevron: { fontSize: 28, color: colors.secondary }, sectionGap: { marginTop: spacing.sm },
  info: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderRadius: 18, backgroundColor: colors.emptyBackground }, empty: { paddingVertical: 32, paddingHorizontal: spacing.lg, alignItems: 'center', gap: spacing.md }, divider: { height: 1, backgroundColor: colors.border },
  calendar: { padding: spacing.sm, borderRadius: 24, gap: spacing.md }, grid: { flexDirection: 'row', flexWrap: 'wrap' }, daySlot: { width: '14.285714%', alignItems: 'center', paddingVertical: 3 }, day: { width: '100%', minHeight: interaction.minTouchSize + 20, alignItems: 'center', justifyContent: 'center', borderRadius: 16, gap: 3 }, dayNumber: { ...typography.secondary, fontWeight: '700' }, dayNote: { fontSize: 9, lineHeight: 14 }, todayDot: { width: 4, height: 4, borderRadius: radius.pill },
  success: { alignItems: 'center', gap: spacing.xxl, paddingVertical: 56 }, preview: { ...typography.small, color: colors.secondary, textAlign: 'center', marginTop: spacing.sm },
  fixedAction: { padding: spacing.xxl, paddingTop: spacing.sm, backgroundColor: colors.background },
  rulesButton: { minHeight: interaction.minTouchSize, alignItems: 'center', justifyContent: 'center' },
  confirmation: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.canvas, justifyContent: 'center', padding: spacing.xxl }, confirmationBody: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xxl, padding: spacing.xxl },
});
