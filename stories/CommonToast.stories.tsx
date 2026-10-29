import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card } from '../src/design/components';
import { Dialog } from '../src/design/Dialog';
import { ToastProvider, useToast } from '../src/design/toast';
import { colors, typography } from '../src/design/theme';
import { CelebrationToast } from '../src/features/celebrations/CelebrationToast';
import { weekDates, type Celebration } from '../src/features/celebrations/model';
function Controls() {
  const toast = useToast();
  const sequence = useRef(0), lastId = useRef<string | null>(null);
  const [dialog, setDialog] = useState(false), [status, setStatus] = useState('');
  return <View style={{ padding: 18, paddingTop: 150, gap: 10 }}>
    <Text style={[typography.title, { color: colors.text }]}>공통 인앱 토스트</Text>
    <Button label="중요 공지" onPress={() => {
      let started: number | null = null;
      lastId.current = toast.show({ title: '새로운 소식이 있어요', message: '공부방의 새 공지를 확인해 주세요.', tone: 'info',
        onShow: () => { started = performance.now(); },
        onDismiss: reason => { if (reason === 'timeout' && started !== null) setStatus(`중요 공지 자동 닫힘 · 표시 시작 후 ${((performance.now() - started) / 1000).toFixed(1)}초`); },
      });
    }} />
    <Button label="저장 완료" variant="secondary" onPress={() => { lastId.current = toast.show({ title: '목표를 저장했어요', tone: 'success', durationMs: 2000 }); }} />
    <Button label="서프라이즈" variant="secondary" onPress={() => { lastId.current = toast.show({ title: '작은 선물이 도착했어요!', message: '오늘도 함께해 줘서 고마워요.', tone: 'reward' }); }} />
    <Button label="도장 → 보상 전환 · 공통 호스트" variant="secondary" onPress={() => {
      const notice: Celebration = { date: '2026-10-31', todayIndex: 5, reward: true,
        days: weekDates('2026-10-31').map((date, index) => ({ date, achieved: index < 6, rest: false, leave: false })) };
      lastId.current = toast.show({ durationMs: null, render: ({ dismiss, reducedMotion, screenReader }) => <CelebrationToast notice={notice} reducedMotion={reducedMotion} screenReader={screenReader} onDismiss={dismiss} /> });
    }} />
    <Button label="같은 이벤트 두 번 호출" variant="secondary" onPress={() => {
      const dedupeKey = `demo:${++sequence.current}`;
      const first = toast.show({ title: '한 번만 안내해요', dedupeKey });
      const second = toast.show({ title: '한 번만 안내해요', dedupeKey });
      setStatus(first && first === second ? '두 호출이 같은 토스트 하나로 합쳐졌어요.' : '표시할 수 없는 상태예요.');
    }} />
    <Button label="알림 세 개 순서대로" variant="secondary" onPress={() => {
      toast.show({ title: '첫 번째 안내', durationMs: 2000 }); toast.show({ title: '두 번째 안내', durationMs: 2000 }); toast.show({ title: '마지막 안내', durationMs: 2000 });
    }} />
    <View style={{ flexDirection: 'row', gap: 8 }}><Button label="내용 갱신" variant="ghost" onPress={() => { if (lastId.current) toast.update(lastId.current, { title: '내용이 갱신됐어요', message: '표시 시간은 처음 시작한 시각을 유지해요.' }); }} /><Button label="현재 알림 닫기" variant="ghost" onPress={() => { if (lastId.current) toast.dismiss(lastId.current); }} /></View>
    <Button label="모달 중 대기 확인" variant="secondary" onPress={() => setDialog(true)} />
    <Text style={[typography.caption, { color: colors.secondary }]}>{status}</Text>
    <Dialog visible={dialog} onClose={() => setDialog(false)} label="공통 토스트 대기 확인"><Card style={{ gap: 16 }}><Text style={[typography.body, { color: colors.text }]}>알림을 예약한 뒤 닫으면 표시돼요.</Text><Button label="알림 예약" onPress={() => { toast.show({ title: '모달이 닫힌 뒤 표시됐어요', tone: 'success' }); setStatus('모달을 닫으면 대기 중인 알림이 표시돼요.'); }} /><Button label="모달 닫기" variant="secondary" onPress={() => setDialog(false)} /></Card></Dialog>
  </View>;
}
function Preview({ width = 390 }: { width?: number }) {
  return <View style={{ width, maxWidth: '100%', height: 810, backgroundColor: colors.background }}><ToastProvider scope="storybook"><Controls /></ToastProvider></View>;
}
const meta = { title: '공통 컴포넌트/공통 토스트', component: Preview, parameters: { layout: 'fullscreen', screenLayout: true } } satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = { name: '호출 · 대기열 · 중복 · 갱신' };
export const Narrow: Story = { name: '320px 공통 토스트', args: { width: 320 } };
