import { colors, layout, spacing } from '../design/theme';
import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';


export function Screen({ children }: PropsWithChildren) {
  return <ScrollView style={styles.background} contentContainerStyle={styles.content}>
    <View style={styles.body}>{children}</View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, alignItems: 'center', padding: layout.pagePadding, justifyContent: 'center' },
  body: { width: '100%', maxWidth: layout.contentWidth, gap: spacing.lg },
});
