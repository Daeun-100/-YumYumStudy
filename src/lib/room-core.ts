export type StudyRoomId = 0 | 1;
export function resolveTestBuild(value: string | undefined, development: boolean): boolean {
  if (value && value !== 'test' && value !== 'production') throw new Error('알 수 없는 앱 환경입니다.');
  return value ? value === 'test' : development;
}
export function scopedRoomKey(key: string, room: StudyRoomId): string {
  return room === 0 ? `yumyumstudy.test-room.${key}` : key;
}
