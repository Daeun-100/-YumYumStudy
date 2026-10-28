import { callRpc } from './rpc';
import { decodeProfile } from './decode';
import { decodeOwnedSkins, decodeSkinId } from '../lib/skins';
import { StudyError } from '../lib/contracts';

export async function getMySkins() {
  const raw = await callRpc('get_my_skins', {});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new StudyError('UNKNOWN', '보유 스킨을 불러오지 못했어요.');
  const row = raw as Record<string, unknown>;
  return { profile: decodeProfile(row.profile), skins: decodeOwnedSkins(row.skins) };
}
export async function applyMySkin(id: string | null) {
  return decodeProfile(await callRpc('apply_my_skin', { p_skin_id: decodeSkinId(id) }));
}
