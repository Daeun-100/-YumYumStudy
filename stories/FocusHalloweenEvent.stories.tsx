import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { Candy, Check, Gift } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { PostitBoard } from '../src/features/postits/PostitBoard';
import type { Postit } from '../src/features/postits/model';
import { FocusScreenView } from '../src/features/study/FocusScreenView';
import { StudyControlView } from '../src/features/study/StudyControlView';
import { Button } from '../src/design/components';
import { Dialog, DialogCloseButton } from '../src/design/Dialog';
import { colors, typography } from '../src/design/theme';
import { halloweenPostit, halloweenPaperSource, halloweenPostitUrl } from './support/halloween-postit';

const paperSource = halloweenPaperSource;
const candyColors = ['#CB7839', '#8B69AC', '#638B70'];
function CandyProgress({ minutes }: { minutes: number }) {
  return <View accessible accessibilityLabel={`사탕 3개 중 ${Math.min(3, Math.floor(minutes / 10))}개, 목표 30분 중 ${Math.min(30, minutes)}분 공부`} style={s.candies}>
    {[10, 20, 30].map((at, index) => <View key={at} style={s.step}>
      <View style={[s.candy, minutes >= at ? { backgroundColor: candyColors[index] } : s.emptyCandy]}><Candy size={22} color={minutes >= at ? '#FFFFFF' : '#C3B6AA'} strokeWidth={1.6} /></View>
      <Text style={[s.stepLabel, minutes >= at && { color: candyColors[index] }]}>{at}분</Text>
    </View>)}
  </View>;
}
function EventBookmark({ minutes, confirming, onOpen }: { minutes: number; confirming: boolean; onOpen(): void }) {
  const count = Math.min(3, Math.floor(minutes / 10));
  const received = count === 3 && !confirming;
  return <Pressable accessibilityRole="button" accessibilityLabel={received ? '할로윈 포스트잇 선물 확인' : `할로윈 이벤트, 사탕 3개 중 ${count}개, 안내 열기`} onPress={onOpen} style={({ pressed }) => [s.bookmark, pressed && { backgroundColor: '#F4DFC4' }]}>
    {received ? <Gift size={20} color="#9B6333" strokeWidth={1.6} /> : <Candy size={21} color="#9B6333" strokeWidth={1.6} />}
    <Text style={s.bookmarkCount}>{received ? '완료' : `${count}/3`}</Text>
    {received && <View style={s.bookmarkCheck}><Check size={9} color="#FFFFFF" strokeWidth={2.5} /></View>}
  </Pressable>;
}
function Preview({ minutes = 20, width = 390, confirming = false }: { minutes?: number; width?: number; confirming?: boolean }) {
  const [elapsed, setElapsed] = useState(minutes), [running, setRunning] = useState(true), [details, setDetails] = useState(false);
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
        <EventBookmark minutes={elapsed} confirming={confirming} onOpen={() => setDetails(true)} />
        <PostitBoard scene={scene} notes={notes} designs={received ? [halloweenPostit] : []} visibleDesigns={[halloweenPostit]} imageUrl={halloweenPostitUrl} noteBorder createId={() => `preview-${Date.now()}`} add={async (id, text, color, x, y, designId) => setNotes(previous => [...previous, { id, text, color, x, y, design_id: designId, design_revision: designId ? halloweenPostit.revision : null, author: '나', room_id: 0, study_date: '2026-10-31', deleted_at: null }])} remove={async id => setNotes(previous => previous.filter(note => note.id !== id))} /></View>}>
      <Dialog visible={details} label={received ? '할로윈 포스트잇 획득' : '할로윈 이벤트 안내'} onClose={() => setDetails(false)}><View style={s.detail}>
        <Text style={s.detailEyebrow}>HALLOWEEN · 10.31</Text><Text style={s.detailTitle}>{received ? '달콤한 선물이 도착했어요' : '공부하고 사탕을 모아요'}</Text>
        <View style={s.largePaper}><Image accessible accessibilityLabel="한정 포스트잇 종이 미리보기" source={paperSource} resizeMode="contain" style={StyleSheet.absoluteFill} /><View style={s.paperText}><Text style={s.paperMessage}>{'오늘도 함께\n공부해요 🎃'}</Text></View></View>
        <CandyProgress minutes={elapsed} /><Text style={s.detailCopy}>{received ? '할로윈 포스트잇을 받았어요.\n포스트잇 작성창의 종이 디자인에서 선택해 보세요.' : '10분 공부할 때마다 사탕 한 개!\n오늘 30분을 채우면 한정 포스트잇을 드려요.\n잠깐 쉬어도 모은 사탕은 그대로예요.'}</Text>
        <View style={s.detailReward}><Gift size={16} color="#AB713E" /><Text style={s.detailRewardText}>한 번 받으면 이벤트가 끝나도 계속 써요</Text></View><DialogCloseButton label={received ? '확인했어요' : '사탕 모으러 가기'} />
      </View></Dialog>
      </FocusScreenView>
    </View>
    <View style={s.previewControls}><Text style={s.previewLabel}>시안 상태 확인</Text><Button label="처음부터" variant="secondary" size="compact" onPress={() => setElapsed(0)} /><Button label="10분 진행" variant="secondary" size="compact" onPress={() => setElapsed(value => Math.min(30, value + 10))} /></View>
  </View>;
}
const s = StyleSheet.create({
  phone: { maxWidth: '100%', overflow: 'hidden', borderRadius: 28, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  bookmark: { position: 'absolute', top: 76, right: 0, width: 44, minHeight: 68, paddingVertical: 10, gap: 6, borderTopLeftRadius: 14, borderBottomLeftRadius: 14, backgroundColor: '#FFF1DC', borderColor: '#E8C89E', borderWidth: 1, borderRightWidth: 0, alignItems: 'center', justifyContent: 'center', boxShadow: '-2px 2px 6px rgba(65,37,19,0.10)' },
  bookmarkCount: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: '#8A5E37' }, bookmarkCheck: { position: 'absolute', right: 4, top: 5, width: 13, height: 13, borderRadius: 7, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  candies: { flexDirection: 'row', gap: 5 }, step: { gap: 3, alignItems: 'center' }, candy: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emptyCandy: { backgroundColor: '#F0E8DE', borderWidth: 1, borderStyle: 'dashed', borderColor: '#D3C7B9' }, stepLabel: { fontSize: 9, color: '#9B9084', fontWeight: '600' },
  detail: { padding: 22, backgroundColor: '#FFFCF7', borderRadius: 24, gap: 14, alignItems: 'center' }, detailEyebrow: { fontSize: 10, letterSpacing: 2, color: '#A5784E', fontWeight: '700' }, detailTitle: { ...typography.title, color: '#68472E', textAlign: 'center' },
  largePaper: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' }, paperText: { padding: 24 }, paperMessage: { fontSize: 15, lineHeight: 23, textAlign: 'center', color: '#68472E', fontWeight: '600' },
  detailCopy: { fontSize: 12, lineHeight: 21, textAlign: 'center', color: '#795B42' }, detailReward: { flexDirection: 'row', gap: 5, alignItems: 'center' }, detailRewardText: { fontSize: 10, color: '#967A62', flexShrink: 1 },
  previewControls: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }, previewLabel: { fontSize: 11, color: colors.secondary },
});
const meta = { title: '화면/집중 할로윈 이벤트', component: Preview, parameters: { screenLayout: true, docs: { description: { component: '앱 FocusScreen이 실제 사용하는 FocusScreenView·StudyControlView·PostitBoard를 그대로 사용합니다. 허용앱 헤더와 72px 공부 조작 버튼, 실제 화면 바깥 레이아웃을 공유하며 예시 데이터만 주입합니다. 오른쪽 가장자리에 이벤트 북마크를 추가한 시안입니다. 타이머와 공부방의 높이를 줄이지 않습니다. 10분마다 사탕 한 개, 30분에 포스트잇을 받습니다. 기존 PostitBoard의 붙이기 버튼·작성·열람·삭제를 함께 표시해 겹침을 확인할 수 있습니다. 북마크를 누르면 설명과 종이 미리보기가 열립니다. 화면 아래 상태 확인 버튼은 Storybook 전용이며 앱에 들어가지 않습니다. 서버 연결·실제 지급·이벤트 노출은 하지 않습니다. 종이와 원형 선택 이미지는 사용자가 제공한 할로윈 PNG 원본입니다.' } } }, args: { minutes: 20, width: 390, confirming: false }, render: args => <Preview key={JSON.stringify(args)} {...args} /> } satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const InProgress: Story = { name: '20분 · 사탕 2개' };
export const BeforeStudy: Story = { name: '공부 전 · 사탕 0개', args: { minutes: 0 } };
export const FirstCandy: Story = { name: '10분 · 첫 사탕', args: { minutes: 10 } };
export const RewardReceived: Story = { name: '30분 · 선물 도착', args: { minutes: 30 } };
export const ConfirmingReward: Story = { name: '30분 · 지급 확인 중', args: { minutes: 30, confirming: true } };
export const Small: Story = { name: '320px · 작은 화면', args: { width: 320 } };
