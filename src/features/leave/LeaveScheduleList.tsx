import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../../design/theme';
import { LeavePlaneIcon } from '../../design/LeavePlaneIcon';

type Item = { kind?: 'free' | 'reward' | 'admin'; id: string; date: string; state: 'used' | 'scheduled' };
const dateLabel = (date: string) => {
  const value = new Date(`${date}T00:00:00Z`);
  return `${value.getUTCMonth() + 1}월 ${value.getUTCDate()}일 (${['일', '월', '화', '수', '목', '금', '토'][value.getUTCDay()]})`;
};
export function LeaveScheduleList({ items, today, onSelect }: { items: Item[]; today: string; onSelect(date: string): void }) {
  const visible = items.filter(item => item.state === 'scheduled' || item.date === today).sort((a, b) => a.date.localeCompare(b.date));
  return <View style={s.section}>
    <Text accessibilityRole="header" style={s.title}>연차 일정</Text>
    {visible.map((item, index) => {
      const used = item.state === 'used';
      const label = item.date === today ? '오늘' : dateLabel(item.date);
      return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${label} 연차 ${used ? '사용 중' : '예약'}, 달력에서 확인`} onPress={() => onSelect(item.date)} style={({ pressed }) => [s.row, index > 0 && s.divider, pressed && { backgroundColor: colors.surfacePressed }]}>
        <View style={s.dateGroup}><Text style={s.date}>{label}</Text>{used && <LeavePlaneIcon size={16} />}</View>
        {item.kind === 'admin' && <Text style={s.status}>관리자 지급</Text>}<Text style={[s.status, used && { color: colors.leave }]}>{used ? '사용 중' : '예약'}</Text><Text style={s.status}>›</Text>
      </Pressable>;
    })}
    {!visible.length && <Text style={s.empty}>예약한 연차가 없어요.</Text>}
  </View>;
}
const s = StyleSheet.create({
  section: { borderTopWidth: 1, borderColor: colors.track, paddingTop: 20 },
  title: { ...typography.body, fontWeight: '700', color: colors.text, marginBottom: 8 },
  row: { minHeight: 56, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { borderTopWidth: 1, borderColor: colors.track },
  dateGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  date: { ...typography.body, color: colors.text, flexShrink: 1 },
  status: { ...typography.secondary, color: colors.secondary },
  empty: { ...typography.secondary, color: colors.secondary, paddingVertical: 16 },
});
