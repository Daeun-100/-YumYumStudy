import { StudyError, toStudyError } from './contracts.ts';
import type { UID } from './contracts.ts';

type User = { id: string };
type Result<T> = { data: T; error: unknown };
export type AuthPort = {
  getSession(): Promise<Result<{ session: { user: User } | null }>>;
  getUser(): Promise<Result<{ user: User | null }>>;
  signInAnonymously(): Promise<Result<{ user: User | null }>>;
};

// A tiny boundary for testing failure/retry/concurrency without creating real users.
export function createAuthBootstrap(auth: AuthPort, knownUid: { read(): Promise<string | null>; save(uid: string): Promise<void> }) {
  let inFlight: Promise<UID> | null = null;
  return function ensureAuthIdentity(): Promise<UID> {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const previousUid = await knownUid.read();
        const stored = await auth.getSession();
        if (stored.error) throw stored.error;
        if (stored.data.session) {
          const verified = await auth.getUser();
          if (verified.error) throw verified.error;
          if (!verified.data.user || verified.data.user.id !== stored.data.session.user.id || (previousUid && previousUid !== verified.data.user.id)) {
            throw new StudyError('UNAUTHORIZED', '저장된 UID와 서버 인증이 일치하지 않습니다. 자동으로 새 사용자를 만들지 않습니다.');
          }
          await knownUid.save(verified.data.user.id);
          return verified.data.user.id;
        }
        if (previousUid) throw new StudyError('UNAUTHORIZED', '이 기기의 기존 인증을 복원하지 못했습니다. 기존 기록 보호를 위해 새 UID를 만들지 않았습니다.');
        const created = await auth.signInAnonymously();
        if (created.error) throw created.error;
        if (!created.data.user) throw new StudyError('UNAUTHORIZED', '자동 UID 발급 결과를 확인하지 못했습니다.');
        await knownUid.save(created.data.user.id);
        return created.data.user.id;
      } catch (error) {
        throw toStudyError(error);
      }
    })().finally(() => { inFlight = null; });
    return inFlight;
  };
}
