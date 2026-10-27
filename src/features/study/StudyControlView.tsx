import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Pause, Play, RefreshCw } from 'lucide-react-native';
import { colors, typography } from '../../design/theme';

/** One fixed-size slot for loading, initial-load recovery and normal timer actions. */
export function StudyControlView({ round = false, reload = false, busy = false, running = false, onPress }: {
  round?: boolean; reload?: boolean; busy?: boolean; running?: boolean; onPress(): void;
}) {
  const Icon = reload ? RefreshCw : running ? Pause : Play;
  return <Pressable accessibilityRole="button" accessibilityLabel={busy ? reload ? '공부 기록 다시 불러오는 중' : '공부 요청 처리 중' : reload ? '공부 기록 새로고침' : running ? '공부 일시정지' : '공부 시작'}
    accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={onPress}
    style={({ pressed }) => ({ width: round ? 72 : '100%', height: round ? 72 : 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 })}>
    {busy ? <ActivityIndicator color={colors.onPrimary} /> : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon size={round ? 26 : reload ? 22 : 18} strokeWidth={1.8} color={colors.onPrimary} />
      {!round && !reload && <Text style={{ ...typography.button, color: colors.onPrimary }}>{running ? '일시정지' : '공부 시작'}</Text>}
    </View>}
  </Pressable>;
}
