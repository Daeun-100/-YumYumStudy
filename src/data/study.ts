import { StudyError, validateGoalWeek } from '../lib/contracts';
import type { ConnectionState, DayRecord, GoalWeek, RoomMember, Snapshot, StudyDate, StudySession, TodayData } from '../lib/contracts';

function unavailable(): never {
  throw new StudyError('NOT_CONFIGURED', '공부 기록 DB 연결이 아직 준비되지 않았습니다.');
}

// 01 owns implementations. Never report fake data or successful writes here.
export async function getToday(): Promise<Snapshot<TodayData>> { return unavailable(); }
export async function startStudy(requestId: string): Promise<Snapshot<StudySession>> {
  if (!requestId.trim()) throw new StudyError('VALIDATION', '시작 요청 ID가 필요합니다.');
  return unavailable();
}
export async function stopStudy(sessionId: string): Promise<Snapshot<StudySession>> {
  if (!sessionId.trim()) throw new StudyError('VALIDATION', '종료할 세션 ID가 필요합니다.');
  return unavailable();
}
export async function getRoom(): Promise<Snapshot<RoomMember[]>> { return unavailable(); }
export async function getGoals(): Promise<GoalWeek> { return unavailable(); }
export async function saveGoals(goals: GoalWeek): Promise<void> {
  validateGoalWeek(goals);
  throw new StudyError('POLICY_PENDING', '목표 변경 적용 정책을 먼저 정해야 합니다.');
}
export async function getHistory(from: StudyDate, to: StudyDate): Promise<Snapshot<DayRecord[]>> {
  if (from > to) throw new StudyError('VALIDATION', '기록 조회 시작일을 확인해 주세요.');
  return unavailable();
}
export function subscribeStudyChanges(onChange: () => void, onState: (state: ConnectionState) => void): () => void {
  // No subscription exists until 01 connects the DB. Make that explicit.
  onState('disconnected');
  void onChange;
  return unavailable();
}
