import { createClient } from '@supabase/supabase-js';
import { createHandler } from './core.ts';
const url = Deno.env.get('SUPABASE_URL')!;
const adminToken = Deno.env.get('ADMIN_NOTIFICATION_TOKEN');
const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
Deno.serve(createHandler({
  secret: Deno.env.get('MONITOR_CRON_SECRET'), adminToken,
  async load(id) {
    const { data, error } = await db.rpc('admin_event_notification_payload', { p_id: id });
    if (error) throw error; return data;
  },
  async send(payload) {
    const response = await fetch(`${url}/functions/v1/admin-notifications`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(45000),
      headers: { 'Content-Type': 'application/json', 'x-admin-notification-token': adminToken! },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    return { ok: response.ok, status: response.status, statusText: body.status };
  },
  async finish(id, state, errorCode) {
    const { error } = await db.rpc('admin_finish_event_notification', { p_id: id, p_state: state, p_error: errorCode ?? null });
    if (error) throw error;
  },
}));
