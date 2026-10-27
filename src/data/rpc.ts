import { roomSwitching } from '../lib/room';
import { finishTiming } from '../lib/performance';
import { getSupabase } from '../lib/supabase';
import { StudyError, toStudyError } from '../lib/contracts';

export let activeRpcCount = 0;

export async function callRpc(name: string, args?: Record<string, unknown>): Promise<unknown> {
  if (roomSwitching) throw new StudyError('VALIDATION', '방을 변경하고 있어요. 잠시 후 다시 시도해 주세요.');
  activeRpcCount++;
  const finish = finishTiming(`rpc.${name}`);
  let succeeded = false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const { data, error } = await getSupabase().rpc(name, args).abortSignal(controller.signal);
    if (error) {
      if (error.code === '42501' || error.code === 'PGRST301' || error.code === 'PGRST302') {
        throw new StudyError('UNAUTHORIZED', '요청 권한을 확인하지 못했습니다. 본인 기록인지 확인해 주세요.');
      }
      if (name === 'mutate_leave' && error.code === '22023') {
        const messages: Record<string, string> = {
          'Leave changed; refresh before making a new request': '연차 예약 상태가 변경되었습니다. 새로 조회한 뒤 다시 요청해 주세요.',
          'Today is required for earned reward': '오늘은 이번 주 보상 연차 획득에 포함된 날이라 연차로 변경할 수 없어요.',
          'Study date changed; confirm again': '공부 날짜가 바뀌었어요. 날짜를 확인하고 다시 신청해 주세요.',
          'Cannot cancel this reservation': '사용이 확정된 연차는 취소하거나 변경할 수 없어요.',
          'No eligible leave': '선택한 날짜에 사용할 수 있는 연차가 없습니다.',
          'Date already reserved': '이미 연차가 예약된 날짜입니다.',
          'Request ID reused with different input': '기존 요청과 내용이 다릅니다. 연차 상태를 다시 확인해 주세요.',
        };
        throw new StudyError('VALIDATION', messages[error.message] ?? '예약 날짜와 연차 상태를 확인한 뒤 다시 요청해 주세요.');
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
    succeeded = true;
    return data;
  } catch (error) {
    throw toStudyError(error);
  } finally {
    finish(succeeded ? 'ok' : 'error');
    activeRpcCount--;
    clearTimeout(timeout);
  }
}
