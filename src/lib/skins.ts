import { decodeCharacter, type CharacterId } from './characters.ts';
import { StudyError } from './contracts.ts';

export type OwnedSkin = { id: string; name: string; character: CharacterId; grantedAt: string };
export function decodeSkinId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(value)) throw new StudyError('VALIDATION', '스킨 정보를 확인해 주세요.');
  return value;
}
export function decodeOwnedSkins(value: unknown): OwnedSkin[] {
  if (!Array.isArray(value)) throw new StudyError('UNKNOWN', '보유 스킨을 불러오지 못했어요.');
  return value.map(row => {
    const id = decodeSkinId(row?.id);
    if (!id || typeof row.name !== 'string' || !row.name.trim() || typeof row.grantedAt !== 'string' || !Number.isFinite(Date.parse(row.grantedAt))) throw new StudyError('UNKNOWN', '스킨 정보를 확인해 주세요.');
    return { id, name: row.name, character: decodeCharacter(row.character), grantedAt: row.grantedAt };
  });
}

// Image support is local to each OTA. Unknown IDs remain valid server choices.
export function supportsSkin(character: CharacterId, skinId: string | null | undefined, registry: Readonly<Record<string, { character: CharacterId }>>): boolean {
  return !!skinId && Object.hasOwn(registry, skinId) && registry[skinId].character === character;
}
