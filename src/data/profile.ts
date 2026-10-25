import type { Profile } from '../lib/contracts';
import { callRpc } from './rpc';
import { decodeProfile } from './decode';

export async function ensureProfile(): Promise<Profile> {
  return decodeProfile(await callRpc('ensure_profile'));
}
