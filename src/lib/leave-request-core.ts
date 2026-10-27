import { StudyError } from './contracts.ts';
import type { LeaveStatus, Snapshot } from './contracts.ts';
import { getStudyDayBounds } from './study-day.ts';
export type LeaveIntent = { action: 'schedule' | 'cancel'; date: string; revision: number; grantId: string | null };
export type LeaveRequest = LeaveIntent & { requestId: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validate(value: LeaveRequest) {
  if (!value || !uuid.test(value.requestId) || !['schedule', 'cancel'].includes(value.action)
    || !Number.isSafeInteger(value.revision) || value.revision < 0
    || (value.grantId !== null && (typeof value.grantId !== 'string' || !uuid.test(value.grantId)))
    || (value.action === 'cancel' && value.grantId === null)) throw new StudyError('VALIDATION', '연차 요청 정보를 확인해 주세요.');
  getStudyDayBounds(value.date);
}
export function createLeaveRequester(deps: {
  uid(): Promise<string>; newId(): string;
  storage: { getItem(key: string): string | null | Promise<string | null>; setItem(key: string, value: string): void | Promise<void>; removeItem(key: string): void | Promise<void> };
  send(request: LeaveRequest): Promise<Snapshot<LeaveStatus>>;
}) {
  let flight: { input: string; promise: Promise<Snapshot<LeaveStatus> | null> } | null = null;
  async function execute(intent?: LeaveIntent) {
    const uid = await deps.uid();
    const key = `yumyumstudy.pending-leave.${uid}`;
    const stored = await deps.storage.getItem(key);
    let request: LeaveRequest;
    if (stored !== null) {
      try { request = JSON.parse(stored); validate(request); }
      catch { throw new StudyError('UNKNOWN', '저장된 연차 요청을 확인하지 못했습니다.'); }
      if (intent && (request.action !== intent.action || request.date !== intent.date || request.revision !== intent.revision || request.grantId !== intent.grantId)) {
        throw new StudyError('VALIDATION', '처리 결과를 확인하지 못한 연차 요청이 있습니다. 기존 요청을 먼저 재확인해 주세요.');
      }
    } else {
      if (!intent) return null;
      request = { ...intent, requestId: deps.newId() }; validate(request);
      await deps.storage.setItem(key, JSON.stringify(request));
    }
    const clear = async () => { if (await deps.storage.getItem(key) === JSON.stringify(request)) await deps.storage.removeItem(key); };
    try {
      if (await deps.uid() !== uid) throw new StudyError('UNAUTHORIZED', '계정이 변경되었습니다.');
      const result = await deps.send(request);
      await clear(); return result;
    } catch (error) {
      // Definite validation rejection cannot have committed. Uncertain failures retain the ID.
      if (error instanceof StudyError && error.code === 'VALIDATION') await clear();
      throw error;
    }
  }
  function run(intent?: LeaveIntent): Promise<Snapshot<LeaveStatus> | null> {
    const input = JSON.stringify(intent ?? null);
    if (flight) return flight.input === input ? flight.promise : flight.promise.then(() => run(intent));
    const promise = execute(intent).finally(() => { flight = null; });
    flight = { input, promise };
    return promise;
  }
  return { submit: (intent: LeaveIntent) => run(intent) as Promise<Snapshot<LeaveStatus>>, resume: () => run() };
}
