import { StudyError, toStudyError } from './contracts.ts';
import type { UID } from './contracts.ts';

type User = { id: string };
type Result<T> = { data: T; error: unknown };
export type AuthPort = {
  getSession(): Promise<Result<{ session: { user: User } | null }>>;
  getUser(): Promise<Result<{ user: User | null }>>;
  signInAnonymously(): Promise<Result<{ user: User | null }>>;
};

// Use only after server verification during bootstrap. RPC authorization still
// happens on the server; this check protects the pending-request storage owner.
export async function readVerifiedSession(auth: Pick<AuthPort, 'getSession'>, verifiedUid: UID): Promise<UID> {
  const { data, error } = await auth.getSession();
  if (error) throw toStudyError(error);
  if (!data.session || data.session.user.id !== verifiedUid) {
    throw new StudyError('UNAUTHORIZED', '현재 인증이 확인된 사용자와 다릅니다. 앱을 다시 열어 본인 인증을 확인해 주세요.');
  }
  return verifiedUid;
}

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
