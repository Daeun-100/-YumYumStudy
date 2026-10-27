import { createTimerMode, isBasicSession } from './timer-mode-core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withTimeout } from '../../lib/with-timeout';
import { Platform } from 'react-native';
import { getSupabase } from '../../lib/supabase';
import { validateSupabaseConfig } from '../../lib/config';
import { studyRoomId } from '../../lib/room';
import { callRpc } from '../../data/rpc';
import { studyGuard } from '../allowed-apps/native';
import type { Snapshot, TodayData } from '../../lib/contracts';
import { applyDeparture } from './guard-core';

// Persist the mode before sending a start: a process restart must not mistake a
// deliberately unmonitored timer for an orphaned guarded session.
export const basicStudyMode = createTimerMode({
  getItem: key => withTimeout(AsyncStorage.getItem(key), 3000, '타이머 설정을 읽지 못했어요. 다시 시도해 주세요.'),
  setItem: (key, id) => withTimeout(AsyncStorage.setItem(key, id), 3000, '타이머 설정을 저장하지 못했어요. 다시 시도해 주세요.'),
  removeItem: key => withTimeout(AsyncStorage.removeItem(key), 3000, '타이머 설정을 정리하지 못했어요. 다시 시도해 주세요.'),
}, () => studyRoomId);
const nativeWait = <T>(value: Promise<T>) => withTimeout(value, 5000, '휴대폰 공부 기록 확인이 지연되고 있어요. 다시 시도해 주세요.');
export async function guardTransport() {
  const { data, error } = await withTimeout(getSupabase().auth.getSession(), 5000, '본인 인증 확인이 지연되고 있어요. 다시 시도해 주세요.');
  if (error || !data.session) throw new Error('공부 감시를 위한 본인 인증을 확인하지 못했어요.');
  const { url, key } = validateSupabaseConfig(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  await nativeWait(studyGuard!.setTransport(`${url.replace(/\/$/, '')}/rest/v1/rpc/stop_study_on_exit`, key, data.session.access_token, data.session.user.id, studyRoomId));
  return data.session.user.id;
}
export async function reconcileAndroidGuard(snapshot: Snapshot<TodayData>, recovered = false): Promise<{ snapshot: Snapshot<TodayData>; notice: string | null }> {
  if (Platform.OS !== 'android' || !studyGuard) return { snapshot, notice: null as string | null };
  const owner = snapshot.data.profile.id;
  const basic = await basicStudyMode.get(owner);
  const active = snapshot.data.activeSession;
  if (active && isBasicSession(basic, active.id)) return { snapshot, notice: null };
  const status = await nativeWait(studyGuard.status());
  const link = status.link;
  if (link && link.ownerId === owner && link.roomId === studyRoomId && link.endedAt
    && (!snapshot.data.activeSession || snapshot.data.activeSession.id === link.sessionId || !link.confirmed)) {
    const stopped = applyDeparture(snapshot, link.sessionId, link.endedAt);
    // Expected automatic pauses do not need the error/status UI.
    const silentPause = status.reason === '화면 잠금 또는 화면 꺼짐으로 일시정지했어요'
      || status.reason === '화면이 꺼져 일시정지했어요'
      || status.reason.startsWith('허용된 이동 경로를 벗어나 자동 일시정지:');
    const notice = silentPause ? null : status.reason;
    try {
      if (!link.confirmed) {
        await guardTransport();
        await withTimeout(callRpc('stop_study_on_exit', { p_session_id: link.sessionId, p_stopped_at: link.endedAt }), 15000, '이전 공부의 중지 기록 동기화가 지연되고 있어요.');
        await nativeWait(studyGuard.acknowledgeStop(link.sessionId));
      }
      return { snapshot: stopped, notice };
    } catch {
      return { snapshot: stopped, notice: `${notice ? `${notice}\n` : ''}공부는 멈췄어요. 서버 기록을 동기화한 뒤 직접 재개해 주세요.` };
    }
  }
  if (active && (!link || link.sessionId !== active.id || link.ownerId !== owner || link.roomId !== studyRoomId)) {
    // Never silently arm monitoring for a session discovered on return/restart.
    if (recovered) throw new Error('휴대폰 공부 기록을 다시 확인해 주세요.');
    await nativeWait(studyGuard.recoverStoppedStudy(active.id, owner, studyRoomId, new Date(active.startedAt).toISOString(), new Date(snapshot.serverNow).toISOString()));
    return reconcileAndroidGuard(snapshot, true);
  }
  if (link && link.ownerId === owner && link.roomId === studyRoomId && !active && !link.endedAt) await nativeWait(studyGuard.acknowledgeStop(link.sessionId));
  if (active) await guardTransport();
  return { snapshot, notice: null as string | null };
}
