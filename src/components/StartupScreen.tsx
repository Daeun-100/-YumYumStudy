import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Button } from '../design/components';
import { colors, typography } from '../design/theme';

export function StartupScreen({ failed = false, onRetry }: { failed?: boolean; onRetry(): void }) {
  return <View style={s.screen} accessibilityViewIsModal>
    <Image source={require('../../assets/app/logo-transparent.png')} style={s.logo} resizeMode="contain" accessibilityLabel="얌얌스터디" fadeDuration={0} />
    <Text style={s.title}>얌얌스터디</Text>
    {failed ? <><Text style={s.caption}>연결을 확인한 뒤 다시 시도해 주세요.</Text><Button label="다시 시도" variant="secondary" size="compact" onPress={onRetry} /></> : <ActivityIndicator accessibilityLabel="공부방 준비 중" color={colors.primary} />}
  </View>;
}
const s = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 20, zIndex: 1000, elevation: 20 },
  logo: { width: 88, height: 88 }, title: { ...typography.title, color: colors.primary }, caption: { ...typography.secondary, color: colors.secondary, textAlign: 'center' },
});
