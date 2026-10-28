export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type Input = { action: 'preview' | 'send' | 'status'; id: string; roomId: number; title: string; body: string; userIds: string[] | null };
export function parseInput(value: unknown): Input {
  if (!value || typeof value !== 'object') throw Error('Invalid input');
  const v = value as Record<string, unknown>;
  if (!['preview','send','status'].includes(String(v.action)) || typeof v.id !== 'string' || !uuid.test(v.id)) throw Error('Action and UUID required');
  if (v.action === 'status') return { action: 'status', id: v.id.toLowerCase(), roomId: 1, title: '', body: '', userIds: null };
  const roomId = v.roomId ?? 1, title = v.title ?? '얌얌스터디 공지', body = v.body;
  if (roomId !== 0 && roomId !== 1) throw Error('Invalid room');
  if (typeof title !== 'string' || !title.trim() || [...title].length > 80 || typeof body !== 'string' || !body.trim() || [...body].length > 160 || /[\u0000-\u001f\u007f]/.test(title + body)) throw Error('Title/body invalid');
  if (v.userIds !== undefined && (!Array.isArray(v.userIds) || !v.userIds.length || v.userIds.length > 100 || v.userIds.some(x => typeof x !== 'string' || !uuid.test(x)))) throw Error('Invalid user IDs');
  return { action: v.action as Input['action'], id: v.id.toLowerCase(), roomId, title, body, userIds: Array.isArray(v.userIds) ? [...new Set(v.userIds.map(x => x.toLowerCase()))].sort() : null };
}
export async function authorized(provided: string | null, expected: string | undefined) {
  if (!expected || expected.length < 64 || !provided || provided.length > 256) return false;
  const digest = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [a,b] = await Promise.all([digest(provided),digest(expected)]);
  let diff = 0; for (let i=0; i<a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
export type Device = { id: string; user_id: string; provider: 'expo' | 'web'; address: unknown };
export type Result = { deviceId: string; userId: string; provider: string; status: string; ticketId?: string; errorCode?: string; invalid?: boolean };
export async function deliverAll(devices: Device[], deliver: (device: Device) => Promise<Partial<Result>>, persist: (results: Result[]) => Promise<void>) {
  const results: Result[] = devices.map(d => ({ deviceId:d.id, userId:d.user_id, provider:d.provider, status:'unknown' }));
  await persist(results); // Durable reservation exists before first external send.
  for (let i=0; i<devices.length; i+=5) {
    await Promise.all(devices.slice(i,i+5).map(async (d,j) => {
      try { Object.assign(results[i+j],await deliver(d)); } catch { results[i+j].status='unknown'; }
    }));
    await persist(results); // If this fails, stop; never dispatch subsequent batches.
  }
  return results;
}
