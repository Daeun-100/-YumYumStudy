import { useState } from 'react';
import { Candy, Check, Gift } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Dialog, DialogCloseButton } from '../../design/Dialog';
import { colors, typography } from '../../design/theme';
import paperPng from '../../../assets/postits/halloween-paper-square.png';
const halloweenPaperSource = typeof paperPng === 'string' ? { uri: paperPng } : paperPng;

const paperSource = halloweenPaperSource;
const candyColors = ['#CB7839', '#8B69AC', '#638B70'];
function CandyProgress({ minutes }: { minutes: number }) {
  return <View accessible accessibilityLabel={`사탕 3개 중 ${Math.min(3, Math.floor(minutes / 10))}개, 목표 30분 중 ${Math.min(30, Math.floor(minutes))}분 공부`} style={s.candies}>
    {[10, 20, 30].map((at, index) => <View key={at} style={s.step}>
      <View style={[s.candy, minutes >= at ? { backgroundColor: candyColors[index] } : s.emptyCandy]}><Candy size={22} color={minutes >= at ? '#FFFFFF' : '#C3B6AA'} strokeWidth={1.6} /></View>
      <Text style={[s.stepLabel, minutes >= at && { color: candyColors[index] }]}>{at}분</Text>
    </View>)}
  </View>;
}
function EventBookmark({ minutes, received, onOpen }: { minutes: number; received: boolean; onOpen(): void }) {
  const count = Math.min(3, Math.floor(minutes / 10));
  return <Pressable accessibilityRole="button" accessibilityLabel={received ? '할로윈 포스트잇 선물 도착, 확인하기' : `할로윈 이벤트, 사탕 3개 중 ${count}개, 안내 열기`} onPress={onOpen} style={({ pressed }) => [s.bookmark, pressed && { backgroundColor: '#F4DFC4' }]}>
    {received ? <Gift size={20} color="#9B6333" strokeWidth={1.6} /> : <Candy size={21} color="#9B6333" strokeWidth={1.6} />}
    {received && <View pointerEvents="none" style={s.bookmarkCheck}><Check size={10} color="#FFFFFF" strokeWidth={2.5} /></View>}
  </Pressable>;
}
export function HalloweenEventView({ minutes, received, onOpen }: { minutes: number; received: boolean; onOpen?(): void }) {
  const [details, setDetails] = useState(false);
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <EventBookmark minutes={minutes} received={received} onOpen={() => { onOpen?.(); setDetails(true); }} />
      <Dialog visible={details} label={received ? '할로윈 포스트잇 획득' : '할로윈 이벤트 안내'} onClose={() => setDetails(false)}><View style={s.detail}>
        <Text style={s.detailTitle}>{received ? '할로윈 포스트잇을 받았어요' : '30분 공부하고 선물 받기'}</Text>
        <View style={s.largePaper}><Image accessible accessibilityLabel="한정 포스트잇 종이 미리보기" source={paperSource} resizeMode="contain" style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} /><View style={s.paperText}><Text style={s.paperMessage}>{'오늘도 함께\n공부해요 🎃'}</Text></View></View>
        <CandyProgress minutes={minutes} /><Text style={s.detailCopy}>{received ? '포스트잇 쓰기에서 선택해 보세요.' : '오늘 30분을 채우면 할로윈 포스트잇을 받아요.'}</Text>
        <DialogCloseButton label={received ? '확인했어요' : '공부하러 가기'} />
      </View></Dialog>
  </View>;
}
const s = StyleSheet.create({
  bookmark: { position: 'absolute', top: 144, right: 0, width: 44, minHeight: 48, borderTopLeftRadius: 14, borderBottomLeftRadius: 14, backgroundColor: '#FFF1DC', borderColor: '#E8C89E', borderWidth: 1, borderRightWidth: 0, alignItems: 'center', justifyContent: 'center' },
  bookmarkCheck: { position: 'absolute', top: 5, right: 4, width: 15, height: 15, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  candies: { flexDirection: 'row', gap: 5 }, step: { gap: 3, alignItems: 'center' }, candy: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emptyCandy: { backgroundColor: '#F0E8DE', borderWidth: 1, borderStyle: 'dashed', borderColor: '#D3C7B9' }, stepLabel: { fontSize: 9, color: '#9B9084', fontWeight: '600' },
  detail: { padding: 22, backgroundColor: '#FFFCF7', borderRadius: 24, gap: 14, alignItems: 'center' }, detailTitle: { ...typography.title, color: '#68472E', textAlign: 'center' },
  largePaper: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' }, paperText: { padding: 24 }, paperMessage: { fontSize: 15, lineHeight: 23, textAlign: 'center', color: '#68472E', fontWeight: '600' },
  detailCopy: { fontSize: 12, lineHeight: 21, textAlign: 'center', color: '#795B42' },
});
