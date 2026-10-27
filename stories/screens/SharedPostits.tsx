import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../../src/design/theme';
import { FocusView } from '../../src/features/study/FocusView';
import { PostitBoard } from '../../src/features/postits/PostitBoard';
import type { Postit } from '../../src/features/postits/model';

const studyToday = '2026-10-27';
type Note = Postit;
const samples: Note[] = [
  { study_date: studyToday, id: '1', room_id: 0, deleted_at: null, x: .16, y: .24, text: '오늘도 조금씩, 같이 힘내자!', author: '다이앤', color: '#F9E8A0' },
  { study_date: studyToday, id: '2', room_id: 0, deleted_at: null, x: .73, y: .35, text: '내일 아침 9시에 같이 공부할 사람?', author: '민지', color: '#F7CED4' },
  { study_date: studyToday, id: '3', room_id: 0, deleted_at: null, x: .40, y: .59, text: '이번 주 목표는 매일 30분 🌱', author: '수현', color: '#DAE8BE' },
  { study_date: '2026-10-26', id: '4', room_id: 0, deleted_at: null, x: .55, y: .20, text: '어제 남긴 포스트잇은 오늘 보이지 않아요.', author: '민지', color: '#F9E8A0' },
];
export type SharedPostitsProps = { noteBorder?: boolean; width?: number; height?: number; empty?: boolean; initialOpen?: boolean; initialPlacement?: boolean };
/** Local fixtures only. This story never contacts the server. */
export function SharedPostits({ noteBorder = false, width = 390, height = 844, empty = false, initialOpen = false, initialPlacement = false }: SharedPostitsProps) {
  const [notes, setNotes] = useState<Note[]>(empty ? [] : samples);
  const [running, setRunning] = useState(true);
  return <View style={[s.phone, { width, height, flexShrink: 0 }]}><SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width, height }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }} style={{ flex: 1 }}>
    <View style={{ width, height }}><FocusView initialSceneSize={{ width, height: height - 350 }} members={[
      { id: '1', name: '다이앤', time: '나', character: 'bunny', active: running, self: true },
      { id: '2', name: '민지', time: '53분', character: 'bear', active: true },
      { id: '3', name: '수현', time: '1시간', character: 'cat', active: true },
      { id: '4', name: '지훈', time: '32분', character: 'puppy', active: false },
    ]} memberCount={4} seconds={1500} goalMinutes={60} running={running} onToggle={() => setRunning(value => !value)} onBack={() => {}} onFriends={() => {}}
      renderRoomOverlay={scene => <PostitBoard createId={() => String(Date.now())} scene={scene} notes={notes.filter(note => note.study_date === studyToday)} embedded noteBorder={noteBorder} initialOpen={initialOpen} initialPlacement={initialPlacement}
        add={async (id, text, color, x, y) => { setNotes(previous => [...previous, { id, text, color, x, y, author: '나', room_id: 0, study_date: studyToday, deleted_at: null }]); }}
        remove={async id => { setNotes(previous => previous.filter(note => note.id !== id)); }} />} />
    </View>
  </SafeAreaProvider></View>;
}
const s = StyleSheet.create({ phone: { maxWidth: '100%', overflow: 'hidden', borderRadius: 28, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border } });
