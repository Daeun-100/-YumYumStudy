import { getSupabase } from '../lib/supabase';
import { ensureIdentity } from '../lib/identity';
import { studyRoomId } from '../lib/room';
import { getStudyDayBounds } from '../lib/study-day';
import { StudyError, toStudyError, type StudySession } from '../lib/contracts';
import { decodeSession } from './decode';

export async function getDaySessions(date: string, memberId?: string): Promise<StudySession[]> {
  const { startMs, endMs } = getStudyDayBounds(date);
  const identity = await ensureIdentity();
  if (memberId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId)) throw new StudyError('VALIDATION', '친구 정보를 확인해 주세요.');
  const userId = memberId ?? identity.id;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    if (memberId) {
      const { error } = await getSupabase().rpc('get_member_history', { p_member_id: memberId, p_from: date, p_to: date }).abortSignal(controller.signal);
      if (error) throw new StudyError('UNAUTHORIZED', '이 친구의 상세 기록을 확인하지 못했어요. 친구 목록을 새로고침해 주세요.');
    }
    const sessions: StudySession[] = [];
    // Paginate so short, frequent sessions cannot silently truncate a day's detail.
    for (let offset = 0; ; offset += 500) {
      const query = getSupabase().from('study_sessions').select('id,user_id,started_at,ended_at');
      const owned = query.eq('user_id', userId).eq('room_id', studyRoomId);
      const overlapping = owned.lt('started_at', new Date(endMs).toISOString())
        .or(`ended_at.is.null,ended_at.gt.${new Date(startMs).toISOString()}`);
      const ordered = overlapping.order('started_at').order('id');
      const { data, error } = await ordered.range(offset, offset + 499).abortSignal(controller.signal);
      if (error) throw new StudyError('NETWORK', '상세 기록을 불러오지 못했어요. 다시 시도해 주세요.');
      if (!data) throw new StudyError('UNKNOWN', '상세 기록을 확인하지 못했어요.');
      sessions.push(...data.map(row => decodeSession({ id: row.id, userId: row.user_id, startedAt: row.started_at, endedAt: row.ended_at })));
      if (data.length < 500) return sessions;
    }
  } catch (error) {
    throw toStudyError(error);
  } finally {
    clearTimeout(timeout);
  }
}
