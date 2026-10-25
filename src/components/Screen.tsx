import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

export function Screen({ children }: PropsWithChildren) {
  return <ScrollView style={styles.background} contentContainerStyle={styles.content}>
    <View style={styles.body}>{children}</View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#F5F7F2' },
  content: { flexGrow: 1, alignItems: 'center', padding: 24, justifyContent: 'center' },
  body: { width: '100%', maxWidth: 480, gap: 16 },
});
