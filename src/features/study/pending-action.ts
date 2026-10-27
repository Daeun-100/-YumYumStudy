export type PendingStudyAction = { type: 'start' } | { type: 'stop'; id: string };

// A server snapshot can settle an uncertain mutation even when its response was lost.
export function actionConfirmed(action: PendingStudyAction | null, activeId: string | null): boolean {
  if (!action) return false;
  return action.type === 'start' ? activeId !== null : activeId !== action.id;
}
