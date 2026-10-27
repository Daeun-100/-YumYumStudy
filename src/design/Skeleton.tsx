import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from './theme';

/** Keep the real layout mounted so loading never changes its measured size. */
export function SkeletonRegion({ loading, children, label = '불러오는 중', gap = 0 }: PropsWithChildren<{ loading: boolean; label?: string; gap?: number }>) {
  return <View style={{ position: 'relative' }}>
    <View style={{ gap, opacity: loading ? 0 : 1 }} accessibilityElementsHidden={loading} importantForAccessibility={loading ? 'no-hide-descendants' : 'auto'} aria-hidden={loading} pointerEvents={loading ? 'none' : 'auto'}>{children}</View>
    {loading && <View accessible accessibilityLabel={label} accessibilityState={{ busy: true }} pointerEvents="none" style={s.overlay}>
      <View style={[s.bar, { width: '42%', height: 20 }]} />
      <View style={[s.bar, { width: '100%', flex: 1, minHeight: 16 }]} />
      <View style={[s.bar, { width: '66%', height: 14 }]} />
    </View>}
  </View>;
}
export function DetailSkeleton() {
  return <View accessible accessibilityLabel="상세 기록 불러오는 중" accessibilityState={{ busy: true }} style={{ minHeight: 240, gap: 20, paddingVertical: 8 }}>
    {[40, 65, 100, 100].map((width, index) => <View key={index} style={[s.bar, { width: `${width}%`, height: index === 1 ? 40 : 24 }]} />)}
  </View>;
}
const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, paddingVertical: 8, gap: 16 },
  bar: { borderRadius: 8, backgroundColor: colors.track },
});
