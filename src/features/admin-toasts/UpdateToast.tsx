import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Sparkles, X } from 'lucide-react-native';
import { colors, interaction, typography } from '../../design/theme';
export function UpdateToastAction({ onClose, onNavigate }: { onClose(): void; onNavigate(): Promise<void> }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const flight = useRef(false);
  const navigate = async () => {
    if (flight.current) return;
    flight.current = true; setBusy(true); setError(false);
    try { await onNavigate(); } catch { setError(true); }
    finally { flight.current = false; setBusy(false); }
  };
  return <UpdateToast busy={busy} error={error} onClose={onClose} onNavigate={() => { void navigate(); }} />;
}
export function UpdateToast({ onClose, onNavigate, busy = false, error = false, waiting = false }: {
  onClose(): void; onNavigate(): void; busy?: boolean; error?: boolean; waiting?: boolean;
}) {
  return <View testID="update-toast" style={s.toast}>
    <View style={s.header}>
      <View style={s.icon} accessible={false}><Sparkles size={21} strokeWidth={1.8} color={colors.primary} /></View>
      <View style={s.heading}><Text accessibilityRole="header" accessibilityLiveRegion="polite" style={s.title}>업데이트가 준비됐어요</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="업데이트 안내 닫기" onPress={onClose}
        style={({ pressed }) => [s.close, pressed && { backgroundColor: colors.surfacePressed }]}><X size={19} strokeWidth={1.8} color={colors.secondary} /></Pressable>
    </View>
    {error && <Text accessibilityLiveRegion="polite" role="status" style={s.error}>업데이트 위치로 이동하지 못했어요. 다시 시도해 주세요.</Text>}
    {waiting && <Text accessibilityLiveRegion="polite" role="status" style={s.waiting}>업데이트 영역이 표시될 때까지 기다리고 있어요.</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel={error ? '업데이트 위치로 이동 다시 시도' : '바로가기'} accessibilityHint="마이페이지의 앱 업데이트 위치로 이동"
      accessibilityState={{ busy, disabled: busy || waiting }} disabled={busy || waiting} onPress={onNavigate}
      style={({ pressed }) => [s.action, pressed && { opacity: 0.7 }]}>
      <Text style={s.actionLabel}>{error ? '다시 시도하기' : '바로가기'}</Text><ArrowRight size={16} color={colors.primary} strokeWidth={1.8} />
    </Pressable>
  </View>;
}
const s = StyleSheet.create({
  toast: { width: '100%', maxWidth: 480, alignSelf: 'center', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, gap: 4, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, boxShadow: '0 8px 30px rgba(37,45,40,0.14)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft },
  heading: { flex: 1, minWidth: 0 }, title: { fontSize: 17, lineHeight: 25, fontWeight: '700', color: colors.text },
  close: { width: interaction.minTouchSize, minHeight: interaction.minTouchSize, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  error: { ...typography.caption, color: colors.error }, waiting: { ...typography.caption, color: colors.primary },
  action: { minHeight: interaction.minTouchSize, paddingHorizontal: 8, alignSelf: 'flex-end', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  actionLabel: { ...typography.link, color: colors.primary, flexShrink: 1, textAlign: 'center' },
});
