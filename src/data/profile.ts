import { validateDisplayName } from '../lib/onboarding';
import { decodeCharacter, type CharacterId } from '../lib/characters';
import type { Profile } from '../lib/contracts';
import { callRpc } from './rpc';
import { decodeProfile } from './decode';
import { studyRoomId } from '../lib/room';

export async function ensureProfile(): Promise<Profile> {
  return decodeProfile(await callRpc('ensure_profile', { p_room_id: studyRoomId }));
}

export async function saveProfile(name: string, character: CharacterId): Promise<Profile> {
  return decodeProfile(await callRpc('set_profile', { p_name: validateDisplayName(name), p_character: decodeCharacter(character) }));
}
