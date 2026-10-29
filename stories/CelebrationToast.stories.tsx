import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../src/design/components';
import { colors, typography } from '../src/design/theme';
import { CelebrationToast } from '../src/features/celebrations/CelebrationToast';
import { weekDates, type Celebration } from '../src/features/celebrations/model';

type PreviewProps = { reward?: boolean; rewardDelay?: number; rewardFailure?: boolean; width?: number; reducedMotion?: boolean; screenReader?: boolean; phase?: 'stamp' | 'reward'; scenario?: 'normal' | 'resume' | 'past' | 'seventh' | 'leave' };
const date = '2026-10-31';
function sample({ reward = false, scenario = 'normal' }: PreviewProps): Celebration {
  return { date: scenario === 'seventh' ? '2026-11-01' : date, todayIndex: scenario === 'seventh' ? 6 : 5, reward: reward && scenario !== 'seventh' && scenario !== 'leave',
    days: weekDates(date).map((value, index) => ({ date: value, achieved: scenario === 'seventh' || (reward ? index < 6 : [0, 2, 5].includes(index)), rest: !reward && index === 1, leave: scenario === 'leave' && index === 5 })) };
}
function Preview(props: PreviewProps) {
  const [iteration, setIteration] = useState(0);
  const [visible, setVisible] = useState(true);
  const [away, setAway] = useState(props.scenario === 'resume');
  const [status, setStatus] = useState('');
  const [started, setStarted] = useState(false);
  const [rewardReply, setRewardReply] = useState<'pending' | 'confirmed' | 'failed'>('pending');
  useEffect(() => {
    if (!props.reward || props.phase || away) return;
    const timer = setTimeout(() => { setRewardReply(props.rewardFailure ? 'failed' : 'confirmed'); }, props.rewardDelay ?? 100);
    return () => clearTimeout(timer);
  }, [props.reward, props.rewardDelay, props.rewardFailure, props.phase, away, iteration]);
  const original = sample(props);
  const notice = { ...original, reward: original.reward && (!!props.phase || rewardReply === 'confirmed'), rewardPending: original.reward && !props.phase && rewardReply === 'pending' };
  return <View style={{ width: props.width ?? 390, maxWidth: '100%', minHeight: 530, backgroundColor: colors.background, borderRadius: 24, padding: 16 }}>
    <Text style={[typography.title, { color: colors.text, marginBottom: 8 }]}>성취 알림</Text>
    <Text style={[typography.caption, { color: colors.secondary, marginBottom: 18 }]}>타이머·진행 막대 없이, 실제 수박 에셋으로 한 번 축하해요.</Text>
    <View style={{ minHeight: 300 }}>
      {away ? <View style={{ padding: 30, backgroundColor: colors.canvas, borderRadius: 24 }}><Text style={{ ...typography.body, color: colors.secondary }}>화면 밖에서 공부 중</Text></View> : visible && props.scenario !== 'past' ? <CelebrationToast key={iteration} notice={notice} reducedMotion={props.reducedMotion} screenReader={props.screenReader} previewPhase={props.phase}
        onDismiss={() => { setVisible(false); setStarted(true); setStatus('사라졌어요. 같은 날 다시 안내하지 않아요.'); }} /> : <Text style={{ ...typography.body, color: colors.secondary, padding: 24 }}>{props.scenario === 'past' ? '지난 공부 날짜의 성취는 안내하지 않아요.' : '기존 기록과 연차 내역은 그대로 남아요.'}</Text>}
    </View>
    <View style={{ gap: 9 }}>
      <Button label="처음부터 재생" onPress={() => { setAway(false); setVisible(true); setRewardReply('pending'); setIteration(i => i + 1); setStarted(false); setStatus(''); }} />
      <Button variant="secondary" label={away ? '같은 공부 날짜에 앱으로 복귀' : '화면 끄기 / 앱 나가기'} onPress={() => {
        if (away) { setAway(false); if (!started && props.scenario !== 'past') { setVisible(true); setStarted(true); setRewardReply('pending'); setIteration(i => i + 1); setStatus('현재 기록을 확인하고 당일 축하를 시작해요.'); } else { setVisible(false); setStatus('이미 시작한 축하는 복원하지 않아요.'); } }
        else { setAway(true); if (visible && props.scenario !== 'resume') setStarted(true); setVisible(false); }
      }} />
    </View>
    <Text accessibilityLiveRegion="polite" style={{ ...typography.caption, color: colors.secondary, marginTop: 13 }}>{status}</Text>
  </View>;
}
const meta = { title: '공통 컴포넌트/성취 토스트', component: Preview, parameters: { layout: 'fullscreen', screenLayout: true }, render: args => <Preview key={JSON.stringify(args)} {...args} /> } satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Goal: Story = { name: '오늘 목표 달성 · 도장 찍기', args: {} };
export const Reward: Story = { name: '목표와 보상 · 도장 모으기', args: { reward: true } };
export const DelayedReward: Story = { name: '보상 응답 3초 · 도장 먼저 표시', args: { reward: true, rewardDelay: 3000 } };
export const ExtraWaitReward: Story = { name: '보상 응답 5초 · 추가 대기 중 전환', args: { reward: true, rewardDelay: 5000 } };
export const TooLateReward: Story = { name: '보상 응답 8초 · 닫힌 뒤 재표시 없음', args: { reward: true, rewardDelay: 8000 } };
export const FailedReward: Story = { name: '보상 응답 실패 · 목표 축하 유지', args: { reward: true, rewardFailure: true } };
export const StampStill: Story = { name: '도장판 정지 화면', args: { reward: true, phase: 'stamp' } };
export const RestStampStill: Story = { name: '오늘 연두색 · 휴무 비행기 · 반짝임', args: { phase: 'stamp' } };
export const RewardStill: Story = { name: '연차 티켓 정지 화면', args: { reward: true, phase: 'reward' } };
export const Narrow: Story = { name: '좁은 320px 화면', args: { reward: true, width: 320 } };
export const ReduceMotion: Story = { name: '동작 줄이기', args: { reward: true, reducedMotion: true } };
export const ScreenReader: Story = { name: '스크린리더 · 긴 표시 시간', args: { reward: true, screenReader: true } };
export const Resume: Story = { name: '화면 밖에서 달성 후 복귀', args: { reward: true, scenario: 'resume' } };
export const PastDay: Story = { name: '지난 공부 날짜는 생략', args: { scenario: 'past' } };
export const Seventh: Story = { name: '7일째 · 추가 연차 없음', args: { reward: true, scenario: 'seventh' } };
export const LeaveDay: Story = { name: '연차일 목표 달성 · 보상 없음', args: { scenario: 'leave' } };

