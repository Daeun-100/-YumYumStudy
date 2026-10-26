import { StudyError, type GoalSettings, type GoalWeek } from '../../lib/contracts.ts';

export const weekdays = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
export function goalText(value: number | null): string {
  if (value === null) return '미설정';
  if (value === 0) return '쉬는 날';
  return [value >= 60 ? `${Math.floor(value / 60)}시간` : '', value % 60 ? `${value % 60}분` : ''].filter(Boolean).join(' ');
}
export function parseGoal(hours: string, minutes: string): number {
  if (!/^\d{1,2}$/.test(hours) || !/^\d{1,2}$/.test(minutes)) throw new StudyError('VALIDATION', '시간과 분을 숫자로 입력해 주세요.');
  const h = Number(hours), m = Number(minutes);
  if (m > 59 || h * 60 + m > 1440 || h * 60 + m === 0) throw new StudyError('VALIDATION', '1분부터 24시간까지 설정할 수 있어요. 휴무는 쉬는 날을 선택해 주세요.');
  return h * 60 + m;
}
export function changeWeekday(settings: GoalSettings, index: number, minutes: number | null): GoalWeek {
  const goals = [...(settings.scheduled ?? settings.current)] as GoalWeek;
  goals[index] = minutes;
  return goals;
}

export function sameGoals(a: GoalWeek, b: GoalWeek): boolean {
  return a.every((value, index) => value === b[index]);
}
// Only locally edited weekdays replace the fresh server values.
export function mergeGoalDraft(settings: GoalSettings, base: GoalWeek, draft: GoalWeek): GoalWeek {
  const latest = settings.scheduled ?? settings.current;
  return latest.map((value, index) => base[index] !== draft[index] ? draft[index] : value) as GoalWeek;
}
