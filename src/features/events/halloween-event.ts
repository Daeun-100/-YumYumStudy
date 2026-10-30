/** One-off 2026 Halloween UI; reward eligibility remains server-owned. */
export const HALLOWEEN_EVENT = {
  startsAt: '2026-10-31T06:00:00+09:00',
  endsAt: '2026-11-01T06:00:00+09:00',
  studyDate: '2026-10-31',
  designId: 'halloween-ghost',
  requiredSeconds: 1800,
} as const;
export function isHalloweenEventActive(now: number): boolean {
  return now >= Date.parse(HALLOWEEN_EVENT.startsAt) && now < Date.parse(HALLOWEEN_EVENT.endsAt);
}
export function halloweenStudyMinutes(studyDate: string | undefined, seconds: number | null): number {
  return studyDate === HALLOWEEN_EVENT.studyDate && seconds !== null && Number.isFinite(seconds)
    ? Math.max(0, Math.min(30, seconds / 60)) : 0;
}
