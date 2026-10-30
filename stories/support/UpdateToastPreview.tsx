import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { UpdateToast } from '../../src/features/admin-toasts/UpdateToast';
import { Button } from '../../src/design/components';
import { colors, typography } from '../../src/design/theme';
import { StudyLayout } from '../screens/StudyLayouts';
import { ProfileUpdates } from '../screens/ProfileUpdates';

export type UpdateToastPreviewProps = {
  width?: number;
  height?: number;
  initialError?: boolean;
  failFirstAttempt?: boolean;
  closeCondition?: 'destination-ready' | 'external-signal';
};

// Shared production toast UI with mocked navigation, EAS and destination signals.
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
        <UpdateToast busy={busy} error={error} waiting={waiting} onNavigate={navigate}
          onClose={() => dismiss(instance.current, '이번 안내를 닫았어요. 내려받은 업데이트는 유지돼요.')} />
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
  controls: { maxWidth: '100%', padding: 16, borderRadius: 20, backgroundColor: colors.surface, gap: 12 },
  controlsTitle: { ...typography.link, color: colors.text },
  controlsText: { ...typography.secondary, color: colors.secondary },
  footnote: { ...typography.caption, color: colors.secondary },
});
