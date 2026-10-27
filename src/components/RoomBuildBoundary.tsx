import { createContext, useContext, useRef, useState, type PropsWithChildren } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../design/components';
import { colors } from '../design/theme';
import { activeRpcCount } from '../data/rpc';
import { getSupabase } from '../lib/supabase';
import { sessionStorage } from '../lib/session-storage';
import { isTestBuild, studyRoomId, selectStudyRoom, lockRoomSwitch, activeRoomOperations } from '../lib/room';
import type { StudyRoomId } from '../lib/room-core';
import { useIdentity } from './IdentityProvider';
const RoomContext = createContext<((room: StudyRoomId) => void) | null>(null);
export function RoomBuildBoundary({ children }: PropsWithChildren) {
  const [room, setRoom] = useState(studyRoomId);
  return <RoomContext.Provider value={(next) => { selectStudyRoom(next); setRoom(next); }}><View key={room} style={{ flex: 1 }}>{children}</View></RoomContext.Provider>;
}
export function TestRoomSelector({ onboarding = false }: { onboarding?: boolean }) {
  const identity = useIdentity();
  const change = useContext(RoomContext);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  if (!isTestBuild || (!onboarding && !identity.profile && !identity.error)) return null;
  async function switchTo(next: StudyRoomId) {
    if (next === studyRoomId || lock.current || identity.loading) return;
    if (activeRpcCount || activeRoomOperations) { setError('처리 중인 요청이 있어요. 잠시 후 다시 시도해 주세요.'); return; }
    lock.current = true; lockRoomSwitch(true); setBusy(true); setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const client = getSupabase();
      const { data, error: authError } = await client.auth.getSession();
      if (authError) throw new Error('현재 인증을 확인하지 못했어요.');
      const uid = data.session?.user.id;
      if (uid) {
        for (const key of [`yumyumstudy.pending-study-start.${uid}`, `yumyumstudy.pending-leave.${uid}`]) {
          if (await sessionStorage.getItem(key)) throw new Error('처리 결과가 확인되지 않은 기록이 있어요. 현재 방에서 먼저 확인해 주세요.');
        }
        if (identity.profile) {
          const { data: today, error } = await client.rpc('get_today').abortSignal(controller.signal);
          if (error) throw new Error('타이머 상태를 확인하지 못했어요. 연결을 확인해 주세요.');
          if (today?.data?.activeSession) throw new Error('진행 중인 공부를 중지한 뒤 방을 바꿔 주세요.');
        }
      }
      change?.(next);
      router.replace('/');
    } catch (failure) { setError(failure instanceof Error ? failure.message : '방을 변경하지 못했어요.'); }
    finally { clearTimeout(timeout); lockRoomSwitch(false); lock.current = false; setBusy(false); }
  }
  return <View pointerEvents="box-none" style={onboarding ? { alignSelf: 'flex-end', gap: 8 } : { position: 'absolute', right: 12, bottom: 92, zIndex: 100, elevation: 10, alignItems: 'flex-end', maxWidth: '94%', gap: 8 }}>
    {expanded && <View style={{ padding: 16, gap: 12, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.track }}>
    <Text style={{ textAlign: 'center', color: colors.primary }}>테스트 버전 · {studyRoomId === 0 ? '0번 테스트 방' : '1번 실제 방 (실제 기록)'}</Text>
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>{([0, 1] as const).map(room => <Button key={room} label={room === 0 ? '0번 테스트 방' : '1번 실제 방'} size="compact" variant="secondary" disabled={busy || identity.loading || room === studyRoomId} onPress={() => { void switchTo(room); }} />)}</View>
    {error && <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text>}
    </View>}
    <Button label={expanded ? '테스트 설정 닫기' : '테스트 설정'} accessibilityLabel={expanded ? '테스트 설정 닫기' : '테스트 설정 열기'} size="compact" variant="secondary" onPress={() => setExpanded(value => !value)} />
  </View>;
}
