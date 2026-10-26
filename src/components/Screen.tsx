import { colors, layout, spacing } from '../design/theme';
import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { isTestRoom } from '../lib/room';

export function Screen({ children }: PropsWithChildren) {
  return <ScrollView style={styles.background} contentContainerStyle={styles.content}>
    <View style={styles.body}>{isTestRoom && <Text accessibilityRole="header" style={{ color: colors.secondary, textAlign: 'center' }}>테스트 방 · 0번</Text>}{children}</View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, alignItems: 'center', padding: layout.pagePadding, justifyContent: 'center' },
  body: { width: '100%', maxWidth: layout.contentWidth, gap: spacing.lg },
});
