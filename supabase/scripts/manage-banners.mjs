// Trusted operator environment only. Never bundle the service key in Expo.
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

export function publishInput(room, input) {
 if (![0,1].includes(room)) throw new Error('Explicit room 0 or 1 is required.');
 if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['message','startsAt','endsAt'].includes(key))) throw new Error('Expected message, optional startsAt and endsAt.');
 const message = typeof input.message === 'string' ? input.message.trim() : '';
 if (!message || [...message].length > 40 || /\p{Cc}/u.test(message)) throw new Error('Message must be 1–40 characters on one line.');
 const instant = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('Use an ISO timestamp with an explicit timezone, e.g. 2026-11-01T06:00:00+09:00.');
  // Reject invalid calendar dates that Date.parse would normalize (e.g. Feb 30).
  const calendar = value.slice(0,10);
  if (new Date(`${calendar}T00:00:00Z`).toISOString().slice(0,10) !== calendar) throw new Error('Invalid calendar date.');
  return new Date(value).toISOString();
 };
 const startsAt = input.startsAt === undefined ? new Date().toISOString() : instant(input.startsAt);
 const endsAt = input.endsAt == null ? null : instant(input.endsAt);
 if (endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('End must be after start.');
 return { p_room_id:room,p_message:message,p_starts_at:startsAt,p_ends_at:endsAt };
}

export async function manageBanner(command, room, input, { url, key, fetcher = fetch }) {
 if (!['show','publish','hide'].includes(command) || ![0,1].includes(room)) throw new Error('Use show|publish|hide with explicit --room 0|1.');
 if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the trusted operator environment.');
 const base = new URL(url);
 if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost','127.0.0.1'].includes(base.hostname))) throw new Error('HTTPS is required.');
 async function request(path, body) {
  const response = await fetcher(new URL(`/rest/v1/${path}`,base), {
   method: body ? 'POST' : 'GET', redirect:'error', signal:AbortSignal.timeout(15000),
   headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
   ...(body ? {body:JSON.stringify(body)} : {}),
  });
  if (!response.ok) throw new Error(`Banner request failed (${response.status}); verify current state before retrying.`);
  return response.json();
 }
 let written;
 if (command === 'publish') written = await request('rpc/admin_publish_room_banner',publishInput(room,input));
 if (command === 'hide') written = await request('rpc/admin_hide_room_banner',{p_room_id:room});
 const rows = await request(`room_banners?room_id=eq.${room}&select=room_id,message,enabled,starts_at,ends_at,updated_at`);
 if (!Array.isArray(rows) || rows.length > 1 || rows.some(row => row.room_id !== room)) throw new Error('Unexpected banner response.');
 const saved = rows[0] ?? null;
 if (command !== 'show' && JSON.stringify(saved) !== JSON.stringify(written)) {
  // JSON key order is not a protocol guarantee.
  const fields = ['room_id','message','enabled','starts_at','ends_at','updated_at'];
  if ((saved === null) !== (written === null) || fields.some(field => saved?.[field] !== written?.[field])) throw new Error('Readback differs; inspect current state before retrying.');
 }
 return saved;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 try {
  const {values,positionals} = parseArgs({allowPositionals:true,options:{room:{type:'string'}}});
  if (positionals.length !== 1 || !['0','1'].includes(values.room)) throw new Error('Usage: node supabase/scripts/manage-banners.mjs show|publish|hide --room 0|1; publish reads JSON from stdin.');
  let input;
  if (positionals[0] === 'publish') {
   let source = '';
   for await (const chunk of process.stdin) { source += chunk; if (source.length > 4096) throw new Error('Input too large.'); }
   input = JSON.parse(source);
  }
  console.log(JSON.stringify(await manageBanner(positionals[0],Number(values.room),input,{
   url:process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,
  }),null,2));
 } catch (error) { console.error(error.message); process.exitCode=1; }
}
