import { createClient } from '@supabase/supabase-js';
import { authorized } from '../admin-notifications/core.ts';
import { parseInput } from './core.ts';
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
Deno.serve(async req => {
  if (req.method !== 'POST') return reply({ error: 'POST required' }, 405);
  if (!await authorized(req.headers.get('x-admin-toast-token'), Deno.env.get('ADMIN_TOAST_TOKEN'))) return reply({ error: 'Unauthorized' }, 401);
  let input;
  try {
    const reader = req.body?.getReader(); if (!reader) throw Error();
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 16000) { await reader.cancel(); return reply({ error: 'Too large' }, 413); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
    input = parseInput(JSON.parse(new TextDecoder().decode(bytes)));
  } catch { return reply({ error: 'Invalid request' }, 400); }
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data, error } = await db.rpc('manage_admin_toasts', { p_input: input });
    if (error) return reply({ error: ['22023', '23514'].includes(error.code) ? error.message : error.code === '40001' ? 'Revision or request conflict' : 'Request failed; query status with the same requestId', code: error.code }, error.code === '40001' ? 409 : ['22023', '23514'].includes(error.code) ? 400 : 500);
    return reply(data);
  } catch { return reply({ error: 'Outcome unknown; query status with the same requestId. Do not resend.' }, 500); }
});
