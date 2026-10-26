import { callRpc } from './rpc';
import { decodeOnboarding, validateDisplayName } from '../lib/onboarding';
import { studyRoomId } from '../lib/room';
export async function getOnboarding() {
  return decodeOnboarding(await callRpc('get_onboarding', { p_room_id: studyRoomId }));
}
export async function joinRoom(code: string) {
  return decodeOnboarding(await callRpc('join_room', { p_room_id: studyRoomId, p_code: code }));
}
export async function setDisplayName(name: string) {
  return decodeOnboarding(await callRpc('set_display_name', { p_name: validateDisplayName(name) }));
}
