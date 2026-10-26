import { House, ChartColumn, Users, Plane, User } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../../design/theme';
function TabIcon({ kind, active }: { kind: string; active: boolean }) {
  const Icon = ({ '홈': House, '기록': ChartColumn, '친구': Users, '연차': Plane, '나': User })[kind] ?? House;
  return <Icon size={24} strokeWidth={2} color={active ? colors.primary : colors.inactiveLabel} />;
}
export function BottomTabs({ onSelect, selected = '홈' }: { onSelect(label: string): void; selected?: string }) {
  return <View accessibilityRole="tablist" accessibilityLabel="하단 메뉴" style={s.tabs}>{['홈', '기록', '친구', '연차', '나'].map(label => <Pressable key={label} accessibilityLabel={label} accessibilityRole="tab" aria-selected={label === selected} accessibilityState={{ selected: label === selected }} onPress={() => onSelect(label)} style={({ pressed }) => [s.tab, pressed && { backgroundColor: colors.surfacePressed }]}><View style={s.tabIcon} accessible={false}><TabIcon kind={label} active={label === selected} /></View><Text style={[s.tabLabel, { color: label === selected ? colors.primary : colors.inactiveLabel }]}>{label}</Text></Pressable>)}</View>;
}

const s = StyleSheet.create({
 tabs: { flexDirection: 'row', backgroundColor: colors.navigation, borderTopWidth: 1, borderColor: colors.border, paddingTop: 10, paddingBottom: 14 },
 tab: { flex: 1, minWidth: 0, minHeight: 52, alignItems: 'center', justifyContent: 'flex-start', gap: 4 },
 tabIcon: { width: 36, height: 28, alignItems: 'center', justifyContent: 'center' },
 tabLabel: { ...typography.label, width: '100%', textAlign: 'center', lineHeight: 20, includeFontPadding: false },
});
