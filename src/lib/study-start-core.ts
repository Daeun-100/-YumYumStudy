import { StudyError, toStudyError } from './contracts.ts';
import type { Snapshot, StudySession } from './contracts.ts';

type Result = Snapshot<StudySession>;
type Storage = {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Storage survives process restarts; only the concurrent-call guard lives in memory.
export function createStudyStarter(deps: {
  getUid(): Promise<string>;
  storage: Storage;
  newId(): string;
  send(requestId: string): Promise<Result>;
}) {
  let flight: { create: boolean; promise: Promise<Result | null> } | null = null;

  function run(create: boolean): Promise<Result | null> {
    if (flight) {
      if (!create || flight.create) return flight.promise;
      // A launch recovery with no pending request must not swallow a button press.
      return flight.promise.then((result) => result ?? run(true));
    }
    const promise = (async () => {
      try {
        const uid = await deps.getUid();
        const key = `yumyumstudy.pending-study-start.${uid}`;
        let requestId: string | null;
        try {
          requestId = await deps.storage.getItem(key);
          if (requestId !== null && !uuid.test(requestId)) {
            throw new Error('Invalid stored request');
          }
          if (requestId === null) {
            if (!create) return null;
            requestId = deps.newId();
            if (!uuid.test(requestId)) throw new Error('Invalid generated request');
            // Never send unless persistence succeeded.
            await deps.storage.setItem(key, requestId);
          }
        } catch {
          throw new StudyError('UNKNOWN', '시작 요청을 기기에 저장하거나 읽지 못했습니다. 저장 공간을 확인하고 다시 시도해 주세요.');
        }
        const result = await deps.send(requestId);
        if (result.data.userId !== uid) {
          throw new StudyError('UNAUTHORIZED', '시작 요청의 UID와 응답이 일치하지 않습니다.');
        }
        try {
          // Another browser tab may have stored a newer request in the meantime.
          if (await deps.storage.getItem(key) === requestId) await deps.storage.removeItem(key);
        } catch {
          throw new StudyError('UNKNOWN', '서버에서 시작을 확인했지만 기기의 요청 정리에 실패했습니다. 같은 요청으로 다시 확인해 주세요.');
        }
        return result;
      } catch (error) {
        // All uncertain outcomes retain the original request, including auth errors.
        throw toStudyError(error);
      }
    })().finally(() => { flight = null; });
    flight = { create, promise };
    return promise;
  }

  return {
    start: () => run(true) as Promise<Result>,
    resume: () => run(false),
  };
}
