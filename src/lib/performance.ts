export type TimingSample = { name: string; durationMs: number; outcome: 'ok' | 'error' };
const samples: TimingSample[] = [];
const now = () => performance.now();

// Bounded, device-local diagnostics. Never record user IDs, tokens or RPC arguments.
export function finishTiming(name: string) {
  const started = now();
  return (outcome: TimingSample['outcome'] = 'ok') => {
    const sample = { name, durationMs: Math.round(now() - started), outcome };
    samples.push(sample);
    if (samples.length > 200) samples.shift();
    if (process.env.EXPO_PUBLIC_PERFORMANCE_LOGS === 'true') console.info('[study-performance]', JSON.stringify(sample));
  };
}
export async function measure<T>(name: string, run: () => Promise<T>): Promise<T> {
  const finish = finishTiming(name);
  try { const result = await run(); finish(); return result; }
  catch (error) { finish('error'); throw error; }
}
export function getTimingSamples(): readonly TimingSample[] { return samples.map(sample => ({ ...sample })); }
