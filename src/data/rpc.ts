import { getSupabase } from '../lib/supabase';
import { StudyError, toStudyError } from '../lib/contracts';

export async function callRpc(name: string, args?: Record<string, unknown>): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const { data, error } = await getSupabase().rpc(name, args).abortSignal(controller.signal);
    if (error) {
      if (error.code === '42501' || error.code === 'PGRST301' || error.code === 'PGRST302') {
        throw new StudyError('UNAUTHORIZED', '요청 권한을 확인하지 못했습니다. 본인 기록인지 확인해 주세요.');
      }
      if (error.code === '22023' || error.code === '22P02' || error.code === '22007' || error.code === '22008') {
        throw new StudyError('VALIDATION', '요청한 ID 또는 날짜 형식을 확인해 주세요.');
      }
      if (error.code === 'PGRST202' || error.code === 'PGRST205' || error.code === '42P01') {
        throw new StudyError('NOT_CONFIGURED', '공부 기록 DB 준비가 필요합니다.');
      }
      if (controller.signal.aborted || !error.code) {
        throw new StudyError('NETWORK', '서버에 연결하지 못했습니다. 상태를 다시 조회한 후 재시도해 주세요.');
      }
      throw new StudyError('UNKNOWN', '공부 기록 요청을 처리하지 못했습니다. 다시 시도해 주세요.');
    }
    return data;
  } catch (error) {
    throw toStudyError(error);
  } finally {
    clearTimeout(timeout);
  }
}
