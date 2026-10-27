import { findingsFor, HTTP_SQL, isScheduledSlot, parseSummaries, windowFor } from './policy.ts';

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing_${name}`);
  return value;
}

async function authenticated(req: Request): Promise<boolean> {
  const secret = Deno.env.get('MONITOR_CRON_SECRET');
  if (!secret) return false;
  const hash = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [actual, expected] = await Promise.all([hash(req.headers.get('Authorization') ?? ''), hash(`Bearer ${secret}`)]);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ expected[i];
  return difference === 0;
}

async function sendDiscord(content: string): Promise<void> {
  const url = new URL(required('DISCORD_WEBHOOK_URL'));
  if (url.protocol !== 'https:' || url.hostname !== 'discord.com' || !url.pathname.startsWith('/api/webhooks/')) throw new Error('invalid_discord_webhook');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`discord_http_${response.status}`);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!await authenticated(req)) return new Response('Unauthorized', { status: 401 });
  let input: { end?: string; dry_run?: boolean };
  try {
    input = await req.json();
    if (!input || typeof input !== 'object' || (input.dry_run !== undefined && typeof input.dry_run !== 'boolean')) throw new Error();
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }
  const now = new Date();
  const end = input.end ? new Date(input.end) : new Date(Math.floor(now.getTime() / 60000) * 60000);
  if (!Number.isFinite(end.getTime())) return Response.json({ error: 'invalid_end' }, { status: 400 });
  // Dry runs may inspect recent history, but can never send a Discord message.
  if (end > now || now.getTime() - end.getTime() > 24 * 60 * 60 * 1000) return Response.json({ error: 'invalid_window' }, { status: 400 });
  if (!input.dry_run && (!isScheduledSlot(end) || now.getTime() - end.getTime() > 5 * 60000)) return Response.json({ status: 'skipped_outside_schedule' });
  const window = windowFor(end);
  const label = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short', hour12: false });
  const period = `${label.format(new Date(window.start))} ~ ${label.format(end)} KST`;
  let stage = 'logs';
  try {
    const projectRef = new URL(required('SUPABASE_URL')).hostname.split('.')[0];
    const url = new URL(`https://api.supabase.com/v1/projects/${projectRef}/analytics/endpoints/logs`);
    url.searchParams.set('sql', HTTP_SQL);
    url.searchParams.set('iso_timestamp_start', window.start);
    url.searchParams.set('iso_timestamp_end', window.end);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${required('MONITOR_MANAGEMENT_TOKEN')}` }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`logs_http_${response.status}`);
    const payload = await response.json();
    if (payload.error || (Array.isArray(payload.errors) && payload.errors.length)) throw new Error('logs_query_error');
    const summaries = parseSummaries(payload.result);
    const findings = findingsFor(summaries);
    // An empty window is unassessed, not proof that the service or log capture is healthy.
    const status = findings.length ? 'finding' : summaries.length ? 'clear' : 'no_observations';
    if (findings.length && !input.dry_run) {
      stage = 'discord';
      await sendDiscord(`🚨 얌얌스터디 Supabase 이상 감지\n${period}\n${findings.map((value) => `• ${value}`).join('\n')}\n확인: https://supabase.com/dashboard/project/${projectRef}/logs`);
    }
    console.log(JSON.stringify({ status, window, summaries, dry_run: !!input.dry_run }));
    return Response.json({ status, window, summaries, findings, notified: !!findings.length && !input.dry_run });
  } catch (error) {
    // Never log raw HTTP responses, headers, URLs, tokens, or user-level log data.
    const code = error instanceof Error && /^(logs_http_\d+|logs_query_error|invalid_log_\w+|inconsistent_log_count|missing_\w+|discord_http_\d+|invalid_discord_webhook)$/.test(error.message) ? error.message : 'monitor_request_failed';
    console.error(JSON.stringify({ status: 'failed', stage, code, window }));
    if (!input.dry_run && stage === 'logs') {
      try {
        await sendDiscord(`⚠️ 얌얌스터디 Supabase 감시 실패\n${period}\n로그를 검사하지 못했습니다 (${code}). 서비스 정상 여부는 확인되지 않았습니다.`);
      } catch {
        console.error('monitor_failure_notification_failed');
      }
    }
    return Response.json({ status: 'failed', stage, code, window }, { status: 502 });
  }
});
