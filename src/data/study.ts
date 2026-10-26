import { StudyError, validateGoalWeek } from '../lib/contracts';
import type { ConnectionState, DayRecord, GoalSettings, GoalWeek, RoomMember, Snapshot, StudyDate, StudySession, TodayData } from '../lib/contracts';
import { getSupabase } from '../lib/supabase';
import { getStudyDayBounds } from '../lib/study-day';
import { callRpc } from './rpc';
import { decodeGoals, decodeGoalSettings, decodeHistory, decodeRoom, decodeSession, decodeSnapshot, decodeToday } from './decode';
import { randomUUID } from 'expo-crypto';
import { createStudyStarter } from '../lib/study-start-core';
import { ensureIdentity } from '../lib/identity';
import { sessionStorage } from '../lib/session-storage';

function validateUuid(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new StudyError('VALIDATION', '올바른 요청 또는 세션 ID가 필요합니다.');
  }
}

export async function getToday(): Promise<Snapshot<TodayData>> {
  return decodeSnapshot(await callRpc('get_today'), decodeToday);
}
async function sendStudyStart(requestId: string): Promise<Snapshot<StudySession>> {
  validateUuid(requestId);
  return decodeSnapshot(await callRpc('start_study', { p_request_id: requestId }), decodeSession);
}
const starter = createStudyStarter({
  getUid: async () => (await ensureIdentity()).id,
  storage: sessionStorage,
  newId: randomUUID,
  send: sendStudyStart,
});
// Screens never generate request IDs or bypass persistent retry handling.
export function startStudy(): Promise<Snapshot<StudySession>> { return starter.start(); }
export function resumePendingStudyStart(): Promise<Snapshot<StudySession> | null> { return starter.resume(); }
export async function stopStudy(sessionId: string): Promise<Snapshot<StudySession>> {
  validateUuid(sessionId);
  return decodeSnapshot(await callRpc('stop_study', { p_session_id: sessionId }), decodeSession);
}
export async function getRoom(): Promise<Snapshot<RoomMember[]>> {
  return decodeSnapshot(await callRpc('get_room'), decodeRoom);
}
export async function getGoals(): Promise<GoalWeek> { return decodeGoals(await callRpc('get_goals')); }
export async function getGoalSettings(): Promise<Snapshot<GoalSettings>> {
  return decodeSnapshot(await callRpc('get_goal_settings'), decodeGoalSettings);
}
export async function saveGoals(goals: GoalWeek): Promise<void> {
  validateGoalWeek(goals);
  await callRpc('save_goals', { p_weekday_minutes: goals });
}
export async function getHistory(from: StudyDate, to: StudyDate): Promise<Snapshot<DayRecord[]>> {
  const start = getStudyDayBounds(from).startMs;
  const end = getStudyDayBounds(to).startMs;
  if (start > end || end - start > 365 * 86400000) throw new StudyError('VALIDATION', '기록은 시작일부터 최대 366일 범위로 조회해 주세요.');
  return decodeSnapshot(await callRpc('get_history', { p_from: from, p_to: to }), decodeHistory);
}
let subscriptionId = 0;
export function subscribeStudyChanges(onChange: () => void, onState: (state: ConnectionState) => void): () => void {
  const client = getSupabase();
  let disposed = false;
  onState('connecting');
  const channel = client.channel(`study-changes-${++subscriptionId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'study_sessions' }, () => { if (!disposed) onChange(); })
    .on('system', {}, (payload) => {
      if (!disposed && payload.extension === 'postgres_changes') {
        onState(payload.status === 'ok' ? 'connected' : 'disconnected');
      }
    })
    .subscribe((status) => {
      // A joined socket can precede the actual database replication listener.
      if (!disposed && status !== 'SUBSCRIBED') onState('disconnected');
    });
  return () => {
    disposed = true;
    void client.removeChannel(channel).catch(() => { /* Already disconnected. */ });
  };
}
