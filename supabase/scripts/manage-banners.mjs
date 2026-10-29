// Trusted operator environment only. Never bundle the service key in Expo.
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';

export function publishInput(room, input) {
 if (![0,1].includes(room)) throw new Error('Explicit room 0 or 1 is required.');
 if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['focusFile','description','startsAt','endsAt'].includes(key))) throw new Error('Expected focusFile, description, optional startsAt and endsAt.');
 if (typeof input.focusFile !== 'string' || !isAbsolute(input.focusFile)) throw new Error('An absolute focusFile PNG path is required.');
 const description = typeof input.description === 'string' ? input.description.trim() : '';
 if (!description || [...description].length > 160 || /\p{Cc}/u.test(description)) throw new Error('Description must be 1–160 characters on one line.');
 const instant = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('Use an ISO timestamp with an explicit timezone.');
  const calendar = value.slice(0,10);
  if (new Date(`${calendar}T00:00:00Z`).toISOString().slice(0,10) !== calendar) throw new Error('Invalid calendar date.');
  return new Date(value).toISOString();
 };
 const startsAt = input.startsAt === undefined ? new Date().toISOString() : instant(input.startsAt);
 const endsAt = input.endsAt == null ? null : instant(input.endsAt);
 if (endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('End must be after start.');
 return { focusFile:input.focusFile,p_room_id:room,p_alt_text:description,p_starts_at:startsAt,p_ends_at:endsAt };
}

export function validatePng(bytes) {
 const width = 1000;
 if (!Buffer.isBuffer(bytes) || bytes.length < 45 || bytes.length > 2097152 || !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii',12,16) !== 'IHDR') throw new Error('Expected a PNG file up to 2MB.');
 if (bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== 300) throw new Error(`Focus PNG must be ${width} × 300.`);
 // Check chunk framing through IEND; a signature/IHDR alone is not an image.
 let position=8, hasData=false;
 while (position + 12 <= bytes.length) {
  const length=bytes.readUInt32BE(position), type=bytes.toString('ascii',position+4,position+8);
  if (position+12+length>bytes.length) break;
  if (type === 'IDAT' && length>0) hasData=true;
  position += length+12;
  if (type === 'IEND') { if (length === 0 && position === bytes.length && hasData) return; break; }
 }
 throw new Error('Incomplete PNG image.');
}
async function readPng(path) {
 if ((await stat(path)).size > 2097152) throw new Error('PNG file must be up to 2MB.');
 return readFile(path);
}
export async function manageBanner(command, room, input, { url, key, fetcher = fetch, readImage = readPng }) {
 if (!['show','publish','hide'].includes(command) || ![0,1].includes(room)) throw new Error('Use show|publish|hide with explicit --room 0|1.');
 if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the trusted operator environment.');
 const base = new URL(url);
 if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost','127.0.0.1'].includes(base.hostname))) throw new Error('HTTPS is required.');
 async function request(path, body, upload=false) {
  const response = await fetcher(new URL(path,base), {
   method: body ? 'POST' : 'GET', redirect:'error', signal:AbortSignal.timeout(30000),
   headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':upload?'image/png':'application/json',...(upload?{'cache-control':'max-age=31536000','x-upsert':'false'}:{})},
   ...(body ? {body:upload?body:JSON.stringify(body)} : {}),
  });
  if (!response.ok) throw new Error(`Banner request failed (${response.status}); inspect current state before retrying. Uploaded files may remain unused.`);
  return response.json();
 }
 let written;
 if (command === 'publish') {
  const {focusFile,...args}=publishInput(room,input);
  // Validate before uploading; new immutable paths preserve the current banner
  // if upload or publishing fails.
  const focus=await readImage(focusFile);
  validatePng(focus);
  args.p_focus_image_path=`rooms/${room}/${randomUUID()}/focus.png`;
  await request(`/storage/v1/object/room-banners/${args.p_focus_image_path}`,focus,true);
  written=await request('/rest/v1/rpc/admin_publish_room_banner',args);
 }
 if (command === 'hide') written = await request('/rest/v1/rpc/admin_hide_room_banner',{p_room_id:room});
 const rows = await request(`/rest/v1/room_banners?room_id=eq.${room}&select=room_id,focus_image_path,alt_text,enabled,starts_at,ends_at,updated_at`);
 if (!Array.isArray(rows) || rows.length > 1 || rows.some(row => row.room_id !== room)) throw new Error('Unexpected banner response.');
 const saved = rows[0] ?? null;
 if (command !== 'show') {
  const fields=['room_id','focus_image_path','alt_text','enabled','starts_at','ends_at','updated_at'];
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
   for await (const chunk of process.stdin) { source += chunk; if (source.length > 8192) throw new Error('Input too large.'); }
   input = JSON.parse(source);
  }
  console.log(JSON.stringify(await manageBanner(positionals[0],Number(values.room),input,{
   url:process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,
  }),null,2));
 } catch (error) { console.error(error.message); process.exitCode=1; }
}
