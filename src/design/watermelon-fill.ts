/** Zero/null goals have no progress. Keep the unrounded ratio until rendering. */
export function watermelonGoalPercent(seconds: number, goalMinutes: number | null): number | null {
  if (goalMinutes === null || !Number.isFinite(goalMinutes) || goalMinutes <= 0) return null;
  if (!Number.isFinite(seconds)) return 0;
  return Math.max(0, Math.min(100, seconds / (goalMinutes * 60) * 100));
}

/** Clip the original image from bottom-left, using a fixed 20-degree boundary. */
export function watermelonFillPoints(percent: number): string {
  const progress = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  if (progress === 0) return '0,100 0,100 0,100';
  if (progress === 100) return '0,0 100,0 100,100 0,100';

  // The artwork occupies a circle of about radius 40 in the 100-unit image.
  // Match the visible area rather than advancing through its transparent corners.
  let low = -1;
  let high = 1;
  for (let i = 0; i < 30; i++) {
    const value = (low + high) / 2;
    const area = (Math.acos(value) - value * Math.sqrt(Math.max(0, 1 - value * value))) / Math.PI;
    if (area > progress / 100) low = value;
    else high = value;
  }
  const slope = Math.tan(Math.PI / 9);
  const threshold = (low + high) / 2 * 40 * Math.hypot(1, slope);
  const distance = ([x, y]: number[]) => y - 50 - slope * (x - 50) - threshold;
  const square = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const points: number[][] = [];
  square.forEach((a, index) => {
    const b = square[(index + 1) % square.length];
    const da = distance(a);
    const db = distance(b);
    if (da >= 0) points.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      points.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  });
  return points.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join(' ');
}
