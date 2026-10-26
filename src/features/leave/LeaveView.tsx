import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  return <View style={s.progressCard}><View style={s.between}><Text style={[s.cardTitle, { flex: 1 }]}>{count >= 6 ? '이번 주 연차 획득 완료' : '이번 주 목표 달성'}</Text><Text style={s.title}>{count}<Text style={s.secondary}>/6일</Text></Text></View>
    <View accessible accessibilityLabel={`이번 주 연차 획득 조건 ${count}일 달성, 6일 중`} style={s.fruitRow}>{Array.from({ length: 6 }, (_, i) => <View key={i} style={s.fruitSlot}>{i < count ? <AchievementIcon size={32} /> : <View style={s.emptyFruit} />}</View>)}</View>
    <Text style={s.caption}>{count >= 6 ? '이번 주 연차 1개를 받았어요.' : `${6 - count}일 더 달성하면 연차 1개를 받아요.`}</Text>
  </View>;
}
export function LeaveInfo({ children }: { children: string }) {
  return <View style={s.info}><InfoIcon /><Text style={[s.secondary, { flex: 1 }]}>{children}</Text></View>;
}
export type LeaveViewProps = LeaveLayoutProps & {
  grants: Grant[]; today: string; busy?: boolean; error?: string | null; notice?: string;
  calendarDays: StudyRecord[]; calendarLoading?: boolean; weeklyLoading?: boolean;
  navigation: ReactNode; onClearNotice(): void; onRefresh(): Promise<void>; onMonthChange(month: string): void;
  unavailable(date: string, changingId: string | null): string | null;
  onApply(date: string, changingId: string | null): Promise<boolean>;
  onCancel(id: string, date: string): Promise<boolean>;
};
export function LeaveView({ character = 'bunny', initialScreen = 'home', initialDate, initialChanging = false, state = 'ready', weeklyDays = 0, initialConfirmation = false,
  grants, today, busy = false, error, notice = '', calendarDays, calendarLoading = false, weeklyLoading = false, navigation, onClearNotice, onRefresh, onMonthChange, unavailable, onApply, onCancel }: LeaveViewProps) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [month, setMonth] = useState(`${(initialDate ?? today).slice(0, 7)}-01`);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate ?? null);
  const [changingId, setChangingId] = useState<string | null>(initialChanging ? 'c' : null);
  const [confirmation, setConfirmation] = useState<false | 'cancel' | 'use' | 'change'>(initialConfirmation === true ? 'cancel' : initialConfirmation || false);
  const [refreshing, setRefreshing] = useState(false);
  const [details, setDetails] = useState<'rules' | 'expiry' | null>(null);
  const loadState = state;
  const refresh = async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } };
  const ready = loadState === 'ready' || loadState === 'empty';
  const available = grants.filter(g => g.state === 'available').sort((a, b) => a.expires.localeCompare(b.expires));
  const scheduled = grants.filter(g => g.state === 'scheduled').sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const expiryGroups = available.reduce<Record<string, number>>((groups, grant) => { groups[grant.expires] = (groups[grant.expires] ?? 0) + 1; return groups; }, {});
  const selectedGrant = grants.find(g => g.date === selectedDate && (g.state === 'scheduled' || g.state === 'used'));
  const changingGrant = grants.find(g => g.id === changingId);
  const confirming = confirmation !== false;
  const overlayOpen = confirming || details !== null;
  const Content = ScrollView;
  const reason = selectedDate ? unavailable(selectedDate, changingId) : null;
  const canApply = !!selectedDate && !reason && (!changingGrant || selectedDate !== changingGrant.date);
  const openCalendar = (date?: string) => { setMonth(`${(date ?? today).slice(0, 7)}-01`); onMonthChange(`${(date ?? today).slice(0, 7)}-01`); setSelectedDate(date ?? null); setChangingId(null); onClearNotice(); setScreen('calendar'); };
  const apply = async () => {
    if (!selectedDate || !canApply || busy) return;
    if (await onApply(selectedDate, changingId)) { setChangingId(null); setConfirmation(false); }
    else setConfirmation(false);
  };
  const cancel = async () => {
    if (!selectedGrant || busy || !selectedDate) return;
    await onCancel(selectedGrant.id, selectedDate); setConfirmation(false);
  };
  const back = () => { setScreen('home'); setChangingId(null); setConfirmation(false); onClearNotice(); };
  return <View style={{ flex: 1 }}>
    <View style={{ flex: 1 }} aria-hidden={overlayOpen} accessibilityElementsHidden={overlayOpen} importantForAccessibility={overlayOpen ? 'no-hide-descendants' : 'auto'}>
      <View style={[s.header, screen === 'calendar' && { justifyContent: 'flex-start' }]}>{screen === 'calendar' && <Button label="←" variant="ghost" size="icon" accessibilityLabel="연차 메인으로 돌아가기" onPress={back} />}<Text accessibilityRole="header" style={s.heading}>{screen === 'home' ? '연차' : '연차 달력'}</Text>{screen === 'home' && <InfoButton accessibilityLabel="연차 이용 안내" onPress={() => setDetails('rules')} />}</View>
      <Content key={screen} style={{ flex: 1 }} contentContainerStyle={[s.content, s.calendarContent]} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}>
        {!!error && <View style={{ gap: spacing.sm }}><Text accessibilityRole="alert" style={[s.secondary, { color: colors.error }]}>{error}</Text><Button label="다시 불러오기" variant="secondary" disabled={refreshing} onPress={() => void refresh()} /></View>}
        {!ready ? <View style={s.empty}>{loadState === 'loading' ? <><ActivityIndicator color={colors.primary} /><Text style={s.secondary}>연차를 불러오고 있어요</Text></> : <><Text accessibilityRole="alert" style={s.cardTitle}>연차 정보를 불러오지 못했어요</Text><Text style={s.secondary}>연결을 확인하고 다시 시도해 주세요.</Text><Button label="다시 시도" onPress={() => void refresh()} /></>}</View> : screen === 'home' ? <>
          <Card style={s.balance}>
            <View style={s.balanceSummary}><Text style={s.cardTitle}>사용 가능한 연차</Text><View accessible accessibilityLabel={`${available.length}개`} style={s.balanceValue}><Text style={s.balanceNumber}>{available.length}</Text><Text style={s.balanceUnit}>개</Text></View></View>
            <Image source={characterArtwork[character].leave} resizeMode="contain" accessibilityLabel={`휴가를 즐기는 ${characterArtwork[character].label}`} pointerEvents="none" style={s.heroArt} />
            {available.length ? <Pressable accessibilityRole="button" accessibilityLabel="전체 연차 만료 내역 보기" onPress={() => setDetails('expiry')} style={s.expiryRow}><Text style={[s.caption, { flex: 1 }]}>가장 빠른 만료 · {dateText(available[0].expires)} 오전 6시</Text><Text style={s.secondary}>›</Text></Pressable> : <Text style={s.caption}>목표를 달성하고 첫 연차를 모아보세요.</Text>}
          </Card>
          {weeklyLoading ? <ActivityIndicator color={colors.primary} accessibilityLabel="주간 달성 불러오는 중" /> : weeklyDays === null ? <Text style={s.secondary}>이번 주 달성 현황을 확인하지 못했어요.</Text> : <WeeklyLeaveProgress days={weeklyDays} />}
          {scheduled.length ? <Pressable accessibilityRole="button" accessibilityLabel="다가오는 연차, 달력에서 확인" onPress={() => openCalendar(scheduled[0].date)} style={({ pressed }) => [s.upcoming, pressed && { backgroundColor: colors.surfacePressed }]}><Text style={s.cardTitle}>다가오는 연차</Text><View style={s.row}><LeaveIcon state="scheduled" size={32} /><Text style={[s.title, { flex: 1 }]}>{dateText(scheduled[0].date!, true)}</Text><Text style={s.chevron}>›</Text></View></Pressable> : <View style={s.upcoming}><Text style={s.cardTitle}>다가오는 연차</Text><Text style={s.secondary}>아직 예약한 연차가 없어요.</Text></View>}
        </> : <>
          <PeriodHeader title={`${parse(month).getUTCFullYear()}년 ${parse(month).getUTCMonth() + 1}월`} onPrevious={() => { setMonth(monthShift(month, -1)); onMonthChange(monthShift(month, -1)); setSelectedDate(null); onClearNotice(); }} onNext={() => { setMonth(monthShift(month, 1)); onMonthChange(monthShift(month, 1)); setSelectedDate(null); onClearNotice(); }} />
          {calendarLoading && <ActivityIndicator color={colors.primary} accessibilityLabel="연차 달력 불러오는 중" />}
          <MonthlyCalendar days={calendarDays} selected={selectedDate ?? ''} onSelect={date => { setSelectedDate(date); onClearNotice(); }} today={today} allowFutureSelection variant="leave" />
          <View style={s.dateActions}>
            <View style={s.between}><Text style={s.cardTitle}>{selectedDate ? dateText(selectedDate, true) : '날짜를 선택해 주세요'}</Text>{selectedGrant && <LeaveBadge state={selectedGrant.state} />}</View>
            {changingGrant ? <>{selectedDate && selectedDate !== changingGrant.date && reason && <Text style={s.secondary}>{reason}</Text>}<Button label={selectedDate && canApply ? `${dateText(selectedDate)}로 변경` : '날짜 변경'} disabled={!canApply || busy || calendarLoading} onPress={() => setConfirmation('change')} /><Button label="변경 그만두기" variant="secondary" onPress={() => { setSelectedDate(changingGrant.date!); setMonth(`${changingGrant.date!.slice(0, 7)}-01`); onMonthChange(`${changingGrant.date!.slice(0, 7)}-01`); setChangingId(null); }} /></> : selectedGrant?.state === 'scheduled' ? <View style={s.row}><Button label="날짜 변경" disabled={busy} style={{ flex: 1 }} onPress={() => { setChangingId(selectedGrant.id); onClearNotice(); }} /><Button label="예약 취소" disabled={busy} variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmation('cancel')} /></View> : selectedGrant?.state === 'used' ? null : <>{selectedDate && reason && <Text style={s.secondary}>{reason}</Text>}<Button label={selectedDate && canApply ? `${dateText(selectedDate)} 연차 사용` : '연차 사용하기'} disabled={!canApply || busy || calendarLoading} onPress={() => setConfirmation('use')} /></>}

          </View>
        </>}
        {!!notice && <View accessibilityLiveRegion="polite">{screen === 'calendar' ? <Text style={s.calendarNotice}>{notice}</Text> : <LeaveInfo>{notice}</LeaveInfo>}</View>}
        
      </Content>
      {screen === 'home' && <><View style={s.fixedAction}><Button label="연차 사용하기" disabled={!ready || busy} onPress={() => openCalendar()} /></View>{navigation}</>}
    </View>
    {details && <View accessibilityViewIsModal role="dialog" aria-modal={true} accessibilityLabel={details === 'rules' ? '연차 이용 안내' : '연차 만료 내역'} style={s.confirmation}><Card style={{ gap: spacing.lg, maxHeight: '90%' }}><Text accessibilityRole="header" style={s.title}>{details === 'rules' ? '연차 이용 안내' : '연차 만료 내역'}</Text><ScrollView>{details === 'rules' ? <Text style={s.secondary}>한 주에 6일 목표를 달성하면 연차 1개를 받아요. 휴무·미설정·연차 사용일은 달성 일수에서 제외돼요. 획득 주 시작일로부터 21일 뒤 오전 6시에 만료돼요. 사용일 오전 6시 전까지 예약을 변경하거나 취소할 수 있어요.</Text> : Object.entries(expiryGroups).map(([expires, count]) => <Text key={expires} style={[s.secondary, { paddingVertical: spacing.sm }]}>{count}개 · {dateText(expires)} 오전 6시까지</Text>)}</ScrollView><Button label="닫기" variant="secondary" onPress={() => setDetails(null)} /></Card></View>}
    {confirming && <View accessibilityViewIsModal role="dialog" aria-modal={true} accessibilityLabel={confirmation === 'cancel' ? '연차 취소 확인' : confirmation === 'change' ? '날짜 변경 확인' : '연차 사용 확인'} style={s.confirmation}><Card style={{ width: '100%', gap: spacing.lg }}>
      <Text accessibilityRole="header" style={s.title}>{confirmation === 'cancel' ? '예약을 취소할까요?' : confirmation === 'change' ? '날짜를 변경할까요?' : '연차를 사용할까요?'}</Text>
      <Text style={s.cardTitle}>{confirmation === 'change' && changingGrant ? `${dateText(changingGrant.date!, true)} → ` : ''}{selectedDate ? dateText(selectedDate, true) : ''}</Text>
      {confirmation === 'cancel' && <Text style={s.secondary}>연차 1개가 돌아오며, 만료일은 그대로예요.</Text>}
      {!!error && <Text accessibilityRole="alert" style={[s.secondary, { color: colors.error }]}>{error}</Text>}
      <Button label={confirmation === 'cancel' ? '예약 취소' : confirmation === 'change' ? '변경' : '사용'} loading={busy} disabled={busy} onPress={() => void (confirmation === 'cancel' ? cancel() : apply())} />
      <Button label={confirmation === 'cancel' ? '예약 유지' : '닫기'} variant="secondary" disabled={busy} onPress={() => setConfirmation(false)} />
    </Card></View>}

  </View>;
}
const s = StyleSheet.create({
  phone: { maxWidth: '100%', borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  statusBar: { height: 44, paddingHorizontal: spacing.xxxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, statusTime: { ...typography.label, fontSize: 14, color: colors.text },
  header: { minHeight: 68, paddingHorizontal: spacing.xxl, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'space-between' }, heroArt: { position: 'absolute', width: 204, height: 204, top: -46, right: -28 }, heroArtCompact: { width: 168, height: 168, top: -36, right: -26 },
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
