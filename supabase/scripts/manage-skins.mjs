// Run on a trusted operator machine only. Never bundle this service key in Expo.
import { parseArgs } from 'node:util';
const { values, positionals } = parseArgs({ allowPositionals: true, options: {
 room: { type: 'string' }, user: { type: 'string' }, skin: { type: 'string' }, name: { type: 'string' }, character: { type: 'string' },
 apply: { type: 'boolean', default: false }, enable: { type: 'boolean', default: false }, by: { type: 'string' },
} });
const [command] = positionals;
if (!['members','catalog','register','grant','apply','reset','enable','disable'].includes(command)) {
 console.log('Usage: node supabase/scripts/manage-skins.mjs members --room 0|1 | catalog | register --skin ID --name NAME --character CHARACTER | enable|disable --skin ID | grant --room 0|1 --user UUID --skin ID [--apply] [--by UUID] | apply --room 0|1 --user UUID --skin ID | reset --room 0|1 --user UUID');
 process.exit(command ? 1 : 0);
}
const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the trusted operator environment.');
const base = new URL(url);
if (base.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(base.hostname)) throw new Error('HTTPS is required.');
const room = values.room === '0' || values.room === '1' ? Number(values.room) : null;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (['members','grant','apply','reset'].includes(command) && room === null) throw new Error('Explicit --room 0 or --room 1 is required.');
if (['grant','apply','reset'].includes(command) && !uuid.test(values.user ?? '')) throw new Error('--user UUID is required.');
if (['register','enable','disable','grant','apply'].includes(command) && !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(values.skin ?? '')) throw new Error('--skin ID is required.');
if (values.by && !uuid.test(values.by)) throw new Error('--by must be a user UUID.');
async function request(path, method='GET', body) {
 const response = await fetch(new URL(`/rest/v1/${path}`,base), { method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type':'application/json', Prefer:'return=representation' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
 const data = await response.json();
 if (!response.ok) throw new Error(`Operation failed (${response.status}): ${data.message ?? 'Check server configuration'}`);
 return data;
}
let result;
if (command === 'members') result = await request(`profiles?select=id,display_name,character,active_skin_id&room_id=eq.${room}&name_confirmed=eq.true&invite_verified_at=not.is.null&order=display_name`);
if (command === 'catalog') result = await request('character_skins?select=id,name,character,grant_enabled&order=id');
if (command === 'register') {
 if (!values.name?.trim() || !['bunny','bear','cat','puppy','maltese','pomeranian','blackcat'].includes(values.character)) throw new Error('--name and a supported --character are required.');
 result = await request('character_skins','POST',{id:values.skin,name:values.name.trim(),character:values.character,grant_enabled:values.enable});
}
if (command === 'enable' || command === 'disable') result = await request(`character_skins?id=eq.${values.skin}`,'PATCH',{grant_enabled:command==='enable'});
if (command === 'grant') result = await request('rpc/admin_grant_skin','POST',{p_user_id:values.user,p_skin_id:values.skin,p_room_id:room,p_apply:values.apply,p_granted_by:values.by??null});
if (command === 'apply' || command === 'reset') result = await request('rpc/admin_apply_skin','POST',{p_user_id:values.user,p_skin_id:command==='reset'?null:values.skin,p_room_id:room});
console.log(JSON.stringify(result,null,2));
