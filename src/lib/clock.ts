import { StudyError } from './contracts.ts';

// Wall clock changes do not affect this snapshot-based display clock.
// Refresh the anchor with the next server snapshot after app resume.
export function createServerClock(serverNow: string, monotonicNow: () => number = () => performance.now()): () => number {
  const serverMs = Date.parse(serverNow);
  if (!Number.isFinite(serverMs)) throw new StudyError('VALIDATION', '서버 시각을 확인하지 못했습니다.');
  const baseline = monotonicNow();
  return () => serverMs + Math.max(0, monotonicNow() - baseline);
}
