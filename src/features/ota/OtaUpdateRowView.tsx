import type { ComponentRef, RefObject } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { colors, spacing, typography } from '../../design/theme';


export function OtaUpdateRowView({ pending, busy = false, onPress, targetRef }: { targetRef?: RefObject<ComponentRef<typeof View> | null>; pending: boolean; busy?: boolean; onPress(): void }) {
  return <View style={s.row}>
    <View style={s.icon} accessible={false}><RefreshCw size={20} color={colors.primary} strokeWidth={1.8} /></View>
    <Text style={s.label}>앱 업데이트</Text>
    <Pressable ref={targetRef} accessibilityRole="button" accessibilityLabel={busy ? '업데이트 처리 중' : pending ? '적용하기' : '앱 업데이트 다시 확인'}
      accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={onPress}
      style={({ pressed }) => [s.action, busy ? s.loading : pending ? s.ready : s.latest, pressed && { opacity: 0.8 }]}>
      {busy ? <ActivityIndicator size="small" color={colors.primary} />
        : <Text numberOfLines={1} style={pending ? s.applyText : s.statusText}>{pending ? '적용하기' : '최신 상태'}</Text>}
    </Pressable>
  </View>;
}
const s = StyleSheet.create({
  row: { height: 76, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 30, alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.body, fontWeight: '600', color: colors.text, flex: 1 },
  action: { width: 88, minHeight: 44, paddingHorizontal: 10, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  ready: { backgroundColor: colors.primary }, loading: { backgroundColor: colors.soft }, latest: { paddingHorizontal: 0, alignItems: 'flex-end' },
  applyText: { ...typography.secondary, fontSize: 14, fontWeight: '600', color: colors.onPrimary },
  statusText: { ...typography.body, fontWeight: '400', textAlign: 'right', color: colors.secondary },
});
