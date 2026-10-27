import { StudyError } from './contracts.ts';

export const characterIds = ['bunny', 'bear', 'cat', 'puppy', 'maltese', 'pomeranian', 'blackcat'] as const;
export type CharacterId = typeof characterIds[number];
export function decodeCharacter(value: unknown): CharacterId {
  if (value === undefined) return 'bunny';
  if (characterIds.includes(value as CharacterId)) return value as CharacterId;
  throw new StudyError('VALIDATION', '캐릭터를 다시 선택해 주세요.');
}
