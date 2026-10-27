import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../../design/theme';
import type { GuardApp } from './native';

export function AllowedAppIcon({ app, size = 44 }: { app: GuardApp; size?: number }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return app.iconUri && app.iconUri !== failedUri
    ? <Image accessible={false} source={{ uri: app.iconUri }} style={[s.icon, { width: size, height: size }]} resizeMode="contain" onError={() => setFailedUri(app.iconUri ?? null)} />
    : <View accessible={false} style={[s.icon, s.fallback, { width: size, height: size }]}><Text style={s.initial}>{Array.from(app.label.trim())[0] || '?'}</Text></View>;
}
const s = StyleSheet.create({
  icon: { width: 44, height: 44, borderRadius: 12, flexShrink: 0 },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft },
  initial: { ...typography.title, color: colors.primary },
});
