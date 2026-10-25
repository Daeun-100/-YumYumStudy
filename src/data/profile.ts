import { StudyError } from '../lib/contracts';
import type { Profile } from '../lib/contracts';

// 01 replaces this with an authenticated, idempotent fixed-room profile RPC.
export async function ensureProfile(): Promise<Profile> {
  throw new StudyError('NOT_CONFIGURED', 'UID 연결은 완료됐습니다. 고정 방과 프로필 DB 연결은 다음 단계에서 준비합니다.');
}
