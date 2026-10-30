import { StyleSheet } from 'react-native';
import { colors, typography, radius, layout } from '../../design/theme';

export const ui = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center' }, page: { flex: 1, width: '100%', maxWidth: layout.maxWidth, backgroundColor: colors.background },
  padding: { paddingHorizontal: layout.pagePadding }, heading: { ...typography.heading, color: colors.text }, title: { ...typography.title, color: colors.text },
  muted: { ...typography.secondary, color: colors.secondary }, body: { ...typography.body, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { height: 14, backgroundColor: colors.track, flex: 1, borderRadius: radius.pill, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
  nav: { flexDirection: 'row', borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.navigation, paddingTop: 8, paddingBottom: 10 }, navItem: { flex: 1, alignItems: 'center', gap: 1, minHeight: 52 },
  status: { marginHorizontal: 24, marginVertical: 12, gap: 8, alignItems: 'center' }, error: { ...typography.secondary, color: colors.error }, link: { ...typography.link, color: colors.primary },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
});
