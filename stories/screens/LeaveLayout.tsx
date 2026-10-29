import { useState } from 'react';
import { Text, View } from 'react-native';
import { colors, spacing, typography } from '../../src/design/theme';
import { LeaveView, type LeaveViewProps } from '../../src/features/leave/LeaveView';
import { reservationReason } from '../../src/features/leave/model';
import { monthStart, parseDate, previewRecord, shiftDate, shiftMonth } from '../../src/features/records/model';
import type { LeaveGrant } from '../../src/lib/contracts';
import { BottomTabs } from '../../src/features/navigation/BottomTabs';
export type { LeaveLayoutProps } from '../../src/features/leave/LeaveView';
import type { LeaveLayoutProps } from '../../src/features/leave/LeaveView';

const today = '2026-10-26';
const samples: LeaveViewProps['grants'] = [
  { id: 'a', state: 'available', earned: '2026-10-17', expires: '2026-11-02' },
  { id: 'b', state: 'available', earned: '2026-10-26', expires: '2026-11-16' },
  { id: 'c', state: 'scheduled', earned: '2026-10-24', expires: '2026-11-09', date: '2026-10-29' },
  { id: 'd', state: 'used', earned: '2026-10-10', expires: '2026-10-26', date: '2026-10-21' },
  { id: 'e', state: 'used', earned: '2026-09-26', expires: '2026-10-12', date: '2026-10-07' },
  { id: 'f', state: 'expired', earned: '2026-10-03', expires: '2026-10-19' },
];
// Fixtures and local mutations stay in Storybook; the app and stories share the view.
export function LeaveLayout({ width = 390, height = 844, weeklyDays = 4, state = 'ready', ...props }: LeaveLayoutProps) {
  const [grants, setGrants] = useState(state === 'empty' ? [] : samples);
  const [month, setMonth] = useState(monthStart(props.initialDate ?? today));
  const [notice, setNotice] = useState('');
  const [loadState, setLoadState] = useState(state);
  const backendGrants: LeaveGrant[] = grants.map(g => ({ id: g.id, status: g.state.toUpperCase() as LeaveGrant['status'],
    earnedAt: `${g.earned}T06:00:00+09:00`, earningWeek: g.earned, expiresAt: `${g.expires}T06:00:00+09:00`, scheduledDate: g.date ?? null }));
  const days = Array.from({ length: parseDate(shiftDate(shiftMonth(month, 1), -1)).getUTCDate() }, (_, i) => {
    const date = shiftDate(month, i); const day = previewRecord(date);
    const reserved = grants.some(g => g.date === date && (g.state === 'scheduled' || g.state === 'used'));
    return { ...day, status: reserved ? 'leave' as const : day.status === 'leave' ? 'empty' as const : day.status };
  });
  return <View style={{ width, maxWidth: '100%', height, borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
    <View style={{ height: 44, paddingHorizontal: spacing.xxxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={[typography.label, { color: colors.text }]}>9:41</Text><Text style={{ color: colors.secondary }}>● ● ▰</Text></View>
    <LeaveView {...props} embedded state={loadState} weeklyDays={weeklyDays} grants={grants} today={today} calendarDays={days} notice={notice}
      onMonthChange={setMonth} onClearNotice={() => setNotice('')}
      navigation={<BottomTabs selected="연차" onSelect={() => {}} />}
      onRefresh={async () => setLoadState('ready')}
      unavailable={(date, changingId) => reservationReason(date, today, backendGrants, Date.parse(`${today}T12:00:00+09:00`), changingId)}
      onApply={async (date, changingId) => {
        const grant = changingId ? grants.find(g => g.id === changingId) : grants.filter(g => g.state === 'available' && g.expires !== null && g.expires > date).sort((a,b) => a.expires!.localeCompare(b.expires!))[0];
        if (!grant) return false;
        setGrants(previous => previous.map(g => g.id === grant.id ? { ...g, state: date === today ? 'used' : 'scheduled', date } : g));
        setNotice('스토리북 시안 · 샘플 데이터만 변경했어요.'); return true;
      }}
      onCancel={async id => { setGrants(previous => previous.map(g => g.id === id ? { ...g, state: 'available', date: undefined } : g)); setNotice('예약을 취소했어요. 연차 1개가 돌아왔어요.'); return true; }} />
  </View>;
}
