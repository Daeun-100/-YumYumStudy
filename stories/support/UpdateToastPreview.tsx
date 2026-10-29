import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Sparkles, X } from 'lucide-react-native';
import { Button } from '../../src/design/components';
import { colors, interaction, typography } from '../../src/design/theme';
import { StudyLayout } from '../screens/StudyLayouts';
import { ProfileUpdates } from '../screens/ProfileUpdates';

export type UpdateToastPreviewProps = {
  width?: number;
  height?: number;
  initialError?: boolean;
  failFirstAttempt?: boolean;
  closeCondition?: 'destination-ready' | 'external-signal';
};

// Storybook-only OTA prototype: no EAS request, reload, or production integration.
export function UpdateToastPreview({ width = 390, height = 844, initialError = false,
  failFirstAttempt = false, closeCondition = 'destination-ready',
}: UpdateToastPreviewProps) {
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [waiting, setWaiting] = useState(false);
  const [result, setResult] = useState('');
  const [location, setLocation] = useState<'home' | 'profile'>('home');
  const [destinationId, setDestinationId] = useState<number | null>(null);
  const instance = useRef(1);
  const attempted = useRef(false);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const dismiss = useCallback((id: number, reason: string) => {
    if (id !== instance.current) return;
    // Late results from a dismissed instance cannot close a newer notice.
    instance.current += 1;
    clearTimeout(timer.current);
    inFlight.current = false;
    setBusy(false);
    setVisible(false);
    setResult(reason);
  }, []);
  const destinationReady = useCallback(() => {
    if (destinationId !== instance.current) return;
    inFlight.current = false;
    setBusy(false);
    if (closeCondition === 'external-signal') { setWaiting(true); return; }
    dismiss(destinationId, '마이페이지의 앱 업데이트 · 적용하기 위치로 이동했어요. 업데이트는 실행하지 않았어요.');
  }, [destinationId, closeCondition, dismiss]);
  const restart = () => {
    instance.current += 1;
    clearTimeout(timer.current);
    inFlight.current = false;
    attempted.current = false;
    setBusy(false);
    setWaiting(false);
    setError(initialError);
    setResult('');
    setLocation('home');
    setDestinationId(null);
    setVisible(true);
  };
  const navigate = () => {
    if (inFlight.current || waiting) return;
    const id = instance.current;
    const shouldFail = failFirstAttempt && !attempted.current;
    attempted.current = true;
    inFlight.current = true;
    setBusy(true);
    setError(false);
    timer.current = setTimeout(() => {
      if (id !== instance.current) return;
      if (shouldFail) { inFlight.current = false; setBusy(false); setError(true); return; }
      setDestinationId(id);
      setLocation('profile');
    }, 450);
  };

  return <View style={s.preview}>
    <View style={[s.phone, { width, height }]}>
      {location === 'home' ? <StudyLayout screen="home" running={false} width={width} height={height} activeFriendCount={0} />
        : <ProfileUpdates initialState="ready" width={width} height={height} focusUpdate onUpdateVisible={destinationReady} />}
      {visible && <View pointerEvents="box-none" style={s.layer}>
        <View testID="update-toast" style={[s.toast, { maxHeight: height - 108 }]}>
          <View style={s.header}>
            <View style={s.icon} accessible={false}><Sparkles size={21} strokeWidth={1.8} color={colors.primary} /></View>
            <View style={s.heading}>
              <Text accessibilityRole="header" style={s.title}>업데이트가 준비됐어요</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="업데이트 안내 닫기" onPress={() => dismiss(instance.current, '이번 실행에서는 안내를 닫았어요. 내려받은 업데이트는 유지돼요.')}
              style={({ pressed }) => [s.close, pressed && { backgroundColor: colors.surfacePressed }]}>
              <X size={19} strokeWidth={1.8} color={colors.secondary} />
            </Pressable>
          </View>
          {error && <Text accessibilityLiveRegion="polite" role="status" style={s.error}>업데이트 위치로 이동하지 못했어요. 다시 시도해 주세요.</Text>}
          {waiting && <Text accessibilityLiveRegion="polite" role="status" style={s.success}>업데이트 영역이 표시될 때까지 기다리고 있어요.</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel={error ? '업데이트 위치로 이동 다시 시도' : '바로가기'} accessibilityHint="마이페이지의 앱 업데이트 위치로 이동"
            accessibilityState={{ busy, disabled: busy || waiting }} disabled={busy || waiting} onPress={navigate}
            style={({ pressed }) => [s.action, pressed && { opacity: 0.7 }]}>
            <Text style={s.actionLabel}>
              {error ? '다시 시도하기' : '바로가기'}
            </Text>
            <ArrowRight size={16} color={colors.primary} strokeWidth={1.8} />
          </Pressable>
        </View>
      </View>}
    </View>
    <View style={[s.controls, { width }]}>
      <Text style={s.controlsTitle}>미리보기 조작</Text>
      <Text accessibilityLiveRegion="polite" style={s.controlsText}>
        {result || (closeCondition === 'external-signal' ? '버튼을 눌러도 유지됩니다. 목적지의 업데이트 영역이 표시됐다는 신호를 받아야 닫혀요.' : '시간제한 없이 유지됩니다. X 또는 마이페이지 업데이트 영역 도착 시 닫혀요.')}
      </Text>
      {closeCondition === 'external-signal' && <Button label="업데이트 영역 표시 완료 신호 보내기" variant="secondary" disabled={!visible || !waiting}
        onPress={() => dismiss(instance.current, '목적지의 업데이트 영역 표시를 확인해 안내를 닫았어요.')} />}
      <Button label="업데이트 준비 상태 다시 보기" variant="secondary" onPress={restart} />
      <Text style={s.footnote}>Storybook 전용 모의 동작입니다. EAS 접속·다운로드·앱 다시 시작은 실행하지 않아요.</Text>
    </View>
  </View>;
}

const s = StyleSheet.create({
  preview: { width: '100%', alignItems: 'center', gap: 20 },
  phone: { maxWidth: '100%', position: 'relative', backgroundColor: colors.background },
  layer: { position: 'absolute', top: 48, left: 16, right: 16, alignItems: 'center' },
  toast: { width: '100%', maxWidth: 480, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, gap: 4, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, boxShadow: '0 8px 30px rgba(37, 45, 40, 0.14)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft },
  heading: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 17, lineHeight: 25, fontWeight: '700', color: colors.text },
  close: { width: interaction.minTouchSize, minHeight: interaction.minTouchSize, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  error: { ...typography.caption, color: colors.error },
  success: { ...typography.caption, color: colors.primary },
  action: { minHeight: interaction.minTouchSize, paddingHorizontal: 8, paddingVertical: 0, backgroundColor: 'transparent', alignSelf: 'flex-end',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  actionLabel: { ...typography.link, color: colors.primary, flexShrink: 1, textAlign: 'center' },
  controls: { maxWidth: '100%', padding: 16, borderRadius: 20, backgroundColor: colors.surface, gap: 12 },
  controlsTitle: { ...typography.link, color: colors.text },
  controlsText: { ...typography.secondary, color: colors.secondary },
  footnote: { ...typography.caption, color: colors.secondary },
});
