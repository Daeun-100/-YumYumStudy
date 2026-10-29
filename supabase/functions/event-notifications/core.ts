import { authorized, uuid } from '../admin-notifications/core.ts';
type Payload = { action: string; id: string; roomId: number; title: string; body: string; userIds: string[]; state: string };
type Outcome = 'completed' | 'failed' | 'unknown' | 'configuration_required';
type Dependencies = {
  secret?: string;
  adminToken?: string;
  load(id: string): Promise<Payload | null>;
  send(payload: Omit<Payload, 'state'>): Promise<{ ok: boolean; status: number; statusText?: string }>;
  finish(id: string, state: Outcome, error?: string): Promise<void>;
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export function createHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return reply({ error: 'POST required' }, 405);
    const token = req.headers.get('authorization')?.replace(/^Bearer /i, '') ?? null;
    if (!await authorized(token, deps.secret)) return reply({ error: 'Unauthorized' }, 401);
    let id: string, dryRun: boolean;
    try {
      const text = await req.text(); if (text.length > 2000) throw Error();
      const input = JSON.parse(text);
      if (!input || typeof input.id !== 'string' || !uuid.test(input.id) || (input.dryRun !== undefined && typeof input.dryRun !== 'boolean')
        || Object.keys(input).some(k => !['id', 'dryRun'].includes(k))) throw Error();
      id = input.id.toLowerCase(); dryRun = input.dryRun === true;
    } catch { return reply({ error: 'Invalid request' }, 400); }
    try {
      const payload = await deps.load(id);
      if (dryRun) return reply({ id, state: payload?.state ?? 'not_found', dryRun: true, configured: Boolean(deps.adminToken && deps.adminToken.length >= 64) });
      if (!payload) return reply({ error: 'Not found' }, 404);
      if (payload.state === 'completed') return reply({ id, state: payload.state });
      if (!deps.adminToken || deps.adminToken.length < 64) {
        await deps.finish(id, 'configuration_required', 'MissingAdminCredential');
        return reply({ id, state: 'configuration_required' }, 503);
      }
      const { state: _state, ...message } = payload;
      // The server-created outbox owns the ID, recipients and copy. No request field can replace them.
      let result;
      try { result = await deps.send(message); }
      catch { await deps.finish(id, 'unknown', 'Network'); return reply({ id, state: 'unknown' }, 502); }
      const state: Outcome = result.ok ? (result.statusText === 'completed' ? 'completed' : 'unknown') : result.status >= 500 ? 'unknown' : 'failed';
      await deps.finish(id, state, state === 'completed' ? undefined : `HTTP${result.status}`);
      return reply({ id, state }, result.ok ? 200 : 502);
    } catch { return reply({ error: 'Outcome unknown; inspect the same notification ID' }, 500); }
  };
}
