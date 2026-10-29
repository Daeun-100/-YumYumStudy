import { isUpdateReloading } from '../features/ota/reload-gate';
import { resolveTestBuild, scopedRoomKey, type StudyRoomId } from './room-core';
export const isTestBuild = resolveTestBuild(process.env.EXPO_PUBLIC_APP_VARIANT, __DEV__);
export let studyRoomId: StudyRoomId = isTestBuild ? 0 : 1;
export let isTestRoom = studyRoomId === 0;
export let roomSwitching = false;
export function lockRoomSwitch(value: boolean) { roomSwitching = value; }
export function selectStudyRoom(room: StudyRoomId) {
  if (!isTestBuild && room !== 1) throw new Error('친구용 앱은 1번 방만 사용할 수 있어요.');
  studyRoomId = room; isTestRoom = room === 0;
}
export function roomStorageKey(key: string): string { return scopedRoomKey(key, studyRoomId); }

// Cover auth + persistent retry storage as well as the eventual RPC.
export let activeRoomOperations = 0;
export async function withRoomOperation<T>(run: () => Promise<T>): Promise<T> {
  if (isUpdateReloading()) throw new Error('업데이트를 적용하고 있어요. 잠시 후 다시 시도해 주세요.');
  if (roomSwitching) throw new Error('방을 변경하고 있어요. 잠시 후 다시 시도해 주세요.');
  activeRoomOperations++;
  try { return await run(); } finally { activeRoomOperations--; }
}
