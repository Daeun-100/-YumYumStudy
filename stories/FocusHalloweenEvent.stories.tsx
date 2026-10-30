import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PostitBoard } from '../src/features/postits/PostitBoard';
import type { Postit } from '../src/features/postits/model';
import { FocusScreenView } from '../src/features/study/FocusScreenView';
import { StudyControlView } from '../src/features/study/StudyControlView';
import { Button } from '../src/design/components';
import { HALLOWEEN_EVENT, isHalloweenEventActive } from '../src/features/events/halloween-event';
import { HalloweenEventView } from '../src/features/events/HalloweenEventView';
import { colors } from '../src/design/theme';
import { halloweenPostit, halloweenPostitUrl } from './support/halloween-postit';

function Preview({ minutes = 20, width = 390, confirming = false, eventNow = HALLOWEEN_EVENT.startsAt }: { minutes?: number; width?: number; confirming?: boolean; eventNow?: string }) {
  const [elapsed, setElapsed] = useState(minutes), [running, setRunning] = useState(true);
  const received = elapsed >= 30 && !confirming;
  const [notes, setNotes] = useState<Postit[]>([
    { id: 'note-1', author: '다은', text: '오늘도 같이 힘내자! 🎃', color: '#F9E8A0', x: .19, y: .24, room_id: 0, study_date: '2026-10-31', deleted_at: null },
    { id: 'note-2', author: '민지', text: '사탕 모으러 왔어요 🍬', color: '#F7CED4', x: .70, y: .41, room_id: 0, study_date: '2026-10-31', deleted_at: null },
  ]);
  return <View style={{ gap: 16, alignItems: 'center' }}>
    <View style={[s.phone, { width, height: 844 }]}>
      <FocusScreenView backgroundId="halloween-focus" effectsEnabled={false} initialSceneSize={{ width, height: 330 }} members={[
        { id: 'self', name: '다이앤', time: '나', active: running, character: 'bunny', self: true },
        { id: 'friend-1', name: '다은', time: '1시간 12분', active: true, character: 'blackcat' },
        { id: 'friend-2', name: '민지', time: '45분', active: true, character: 'maltese' },
        { id: 'friend-3', name: '지훈', time: '쉬는 중', active: false, character: 'pomeranian' },
      ]} memberCount={4} seconds={elapsed * 60} sessionSeconds={elapsed * 60} goalMinutes={120} running={running} onBack={() => {}} onFriends={() => {}} onAllowedApps={() => {}} timerControl={<StudyControlView round roundSize={72} running={running} onPress={() => setRunning(value => !value)} />} onToggle={() => setRunning(value => !value)} renderRoomOverlay={scene => <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {isHalloweenEventActive(Date.parse(eventNow)) && <HalloweenEventView minutes={elapsed} received={received} />}
        <PostitBoard scene={scene} notes={notes} designs={received ? [halloweenPostit] : []} visibleDesigns={[halloweenPostit]} imageUrl={halloweenPostitUrl} noteBorder createId={() => `preview-${Date.now()}`} add={async (id, text, color, x, y, designId) => setNotes(previous => [...previous, { id, text, color, x, y, design_id: designId, design_revision: designId ? halloweenPostit.revision : null, author: '나', room_id: 0, study_date: '2026-10-31', deleted_at: null }])} remove={async id => setNotes(previous => previous.filter(note => note.id !== id))} /></View>}>

      </FocusScreenView>
    </View>
    <View style={s.previewControls}><Text style={s.previewLabel}>시안 상태 확인</Text><Button label="처음부터" variant="secondary" size="compact" onPress={() => setElapsed(0)} /><Button label="10분 진행" variant="secondary" size="compact" onPress={() => setElapsed(value => Math.min(30, value + 10))} /></View>
  </View>;
}
const s = StyleSheet.create({
  phone: { maxWidth: '100%', overflow: 'hidden', borderRadius: 28, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  previewControls: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }, previewLabel: { fontSize: 11, color: colors.secondary },
});
const meta = { title: '화면/집중 할로윈 이벤트', component: Preview, parameters: { screenLayout: true, docs: { description: { component: '앱 FocusScreen이 실제 사용하는 FocusScreenView·StudyControlView·PostitBoard를 그대로 사용합니다. 허용앱 헤더와 72px 공부 조작 버튼, 실제 화면 바깥 레이아웃을 공유하며 예시 데이터만 주입합니다. 오른쪽 가장자리에 이벤트 북마크를 표시합니다. 타이머와 공부방의 높이를 줄이지 않습니다. 10분마다 사탕 한 개, 30분에 포스트잇을 받습니다. 기존 PostitBoard의 붙이기 버튼·작성·열람·삭제를 함께 표시해 겹침을 확인할 수 있습니다. 북마크를 누르면 설명과 종이 미리보기가 열립니다. 화면 아래 상태 확인 버튼은 Storybook 전용이며 앱에 들어가지 않습니다. 실제 앱과 같은 HalloweenEventView를 사용하고 한국시간 2026-10-31 06:00부터 24시간의 날짜 조건을 적용합니다. 스토리북은 날짜와 보유 데이터를 주입하며 서버 연결·실제 지급은 하지 않습니다. 종이와 원형 선택 이미지는 사용자가 제공한 할로윈 PNG 원본입니다.' } } }, args: { minutes: 20, width: 390, confirming: false, eventNow: HALLOWEEN_EVENT.startsAt }, render: args => <Preview key={JSON.stringify(args)} {...args} /> } satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const InProgress: Story = { name: '20분 · 사탕 2개' };
export const BeforeStudy: Story = { name: '공부 전 · 사탕 0개', args: { minutes: 0 } };
export const FirstCandy: Story = { name: '10분 · 첫 사탕', args: { minutes: 10 } };
export const RewardReceived: Story = { name: '30분 · 선물 도착', args: { minutes: 30 } };
export const ConfirmingReward: Story = { name: '30분 · 지급 확인 중', args: { minutes: 30, confirming: true } };
export const Small: Story = { name: '320px · 작은 화면', args: { width: 320 } };

export const BeforeEvent: Story = { name: '시작 전 · 북마크 숨김', args: { eventNow: '2026-10-31T05:59:59+09:00', minutes: 0 } };
export const AfterEvent: Story = { name: '종료 후 · 북마크 숨김', args: { eventNow: HALLOWEEN_EVENT.endsAt, minutes: 30 } };
