import { decodeProfile } from '../data/decode.ts';
import { StudyError } from './contracts.ts';
import type { Profile } from './contracts.ts';
export type Onboarding = { step: 'invite' | 'name' | 'ready'; profile: Profile | null };
export function decodeOnboarding(value: unknown): Onboarding {
  const row = value as Partial<Onboarding> & { error?: string } | null;
  const errors: Record<string, string> = {
    INVITE_NOT_CONFIGURED: '아직 입장을 준비 중이에요. 초대한 친구에게 알려주세요.',
    INVALID_INVITE: '초대 코드가 맞지 않아요. 다시 확인해 주세요.',
    RATE_LIMITED: '입력 횟수를 초과했어요. 15분 후 다시 시도해 주세요.',
  };
  if (row?.error) throw new StudyError('VALIDATION', errors[row.error] ?? '입장을 확인하지 못했어요.');
  if (!row || !['invite', 'name', 'ready'].includes(row.step ?? '')
    || (row.step !== 'invite' && (!row.profile || typeof row.profile.id !== 'string' || !row.profile.id
      || typeof row.profile.displayName !== 'string' || !row.profile.displayName))) {
    throw new StudyError('UNKNOWN', '입장 상태를 확인하지 못했어요. 다시 시도해 주세요.');
  }
  return { step: row.step as Onboarding['step'], profile: row.step === 'invite' ? null : decodeProfile(row.profile) };
}
export function validateDisplayName(value: string): string {
  const name = value.trim();
  if (Array.from(name).length < 1 || Array.from(name).length > 12 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new StudyError('VALIDATION', '이름은 공백을 제외한 1~12자로 입력해 주세요.');
  }
  return name;
}
