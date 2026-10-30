// Trusted operator CLI. Credentials are read only from private environment variables.
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identifier=/^[a-z0-9][a-z0-9-]{0,79}$/;
export function validateRequest(p) {
 if(!p || typeof p!=='object' || Array.isArray(p)) throw new Error('Request object required.');
 if(!uuid.test(p.request_id??'') || !identifier.test(p.event_id??'') || typeof p.name!=='string' || !p.name.trim()
  || !/^docs\/events\/[a-zA-Z0-9_-]+\.md$/.test(p.document_path??'') || ![0,1].includes(p.room_id)) throw new Error('Explicit event ID, name, document path, room and request UUID required.');
 const timestamp=(value)=>typeof value==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:00(?:\.000)?(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
 if(!timestamp(p.run_at)) throw new Error('Start time needs a year, minute precision and explicit timezone.');
 if(p.notification!==undefined) {
  const n=p.notification;
  if(!n || typeof n!=='object' || Array.isArray(n) || Object.keys(n).some(k=>!['enabled','title','body'].includes(k))
   || (n.enabled!==undefined && typeof n.enabled!=='boolean')) throw new Error('Invalid notification settings.');
  for(const [key,max] of [['title',80],['body',160]]) if(n[key]!==undefined && (typeof n[key]!=='string' || !n[key].trim() || [...n[key].trim()].length>max || /[\u0000-\u001f\u007f]/.test(n[key]))) throw new Error('Invalid notification copy.');
 }
 if('artwork_revision' in p || 'skin_revisions' in p) throw new Error('Image revisions are no longer supported.');
 if(p.replaces && !uuid.test(p.replaces)) throw new Error('Replacement UUID required.');
 if('user_ids' in p) {
  if(p.kind!=='grant_skins' || !Array.isArray(p.user_ids) || p.user_ids.length<1 || p.user_ids.length>500
   || !p.user_ids.every(id=>typeof id==='string' && uuid.test(id))
   || new Set(p.user_ids.map(id=>id.toLowerCase())).size!==p.user_ids.length) throw new Error('Choose 1–500 distinct recipient UUIDs for a skin grant.');
 }
 if(p.kind==='grant_skins') {
  if(!Array.isArray(p.skin_ids)||!p.skin_ids.length||!p.skin_ids.every(id=>/^[a-z0-9][a-z0-9_-]{0,79}$/.test(id))) throw new Error('Skin IDs required.');
 } else if(p.kind==='set_backgrounds') {
  if(!timestamp(p.ends_at)||Date.parse(p.ends_at)<=Date.parse(p.run_at)||!identifier.test(p.background_id??'')
    ||!Array.isArray(p.screens)||!p.screens.length||!p.screens.every(s=>['home','focus'].includes(s))) throw new Error('Background, screens and end time required.');
 } else throw new Error('Unsupported event action.');
 return p;
}
export function summarizeReport(report) {
 return {events:report.events,backgrounds:report.backgrounds,jobs:report.jobs.map(j=>({
  id:j.id,eventId:j.event_id,kind:j.kind,room:j.room_id,runAt:j.run_at,endsAt:j.ends_at,state:j.state,overdue:j.overdue,
  recipients:j.recipients.length,skinIds:j.skin_ids,backgroundId:j.background_id,screens:j.screens,cron:j.cron,
  cronHistory:j.cronHistory,runs:j.runs.map(r=>({id:r.id,phase:r.phase,recovery:r.recovery,result:r.result,startedAt:r.started_at,finishedAt:r.finished_at,
    counts:r.deliveries.reduce((counts,d)=>({...counts,[d.result]:(counts[d.result]??0)+1}),{}),
    users:new Set(r.deliveries.map(d=>d.user_id)).size,
  })),
 }))};
}
export async function main(argv=process.argv.slice(2)) {
 const {values,positionals}=parseArgs({args:argv,allowPositionals:true,options:{request:{type:'string'},job:{type:'string'},phase:{type:'string'},id:{type:'string'},enabled:{type:'boolean'},disabled:{type:'boolean'},details:{type:'boolean'},help:{type:'boolean'}}});
 const [command]=positionals;
 if(values.help||!command) {console.log('Usage: node supabase/scripts/manage-events.mjs schedule --request FILE | list | status --job UUID | cancel --job UUID | recover --job UUID --phase grant|start|end | background --id ID --enabled|--disabled\nAdd --details to include private recipient/delivery records.');return;}
 if(!['schedule','list','status','cancel','recover','background'].includes(command)) throw new Error('Unknown command.');
 if(['status','cancel','recover'].includes(command)&&!uuid.test(values.job??'')) throw new Error('--job UUID required.');
 let request;
 if(command==='schedule') {if(!values.request)throw new Error('--request FILE required.');request=validateRequest(JSON.parse(await readFile(values.request,'utf8')));}
 if(command==='recover'&&!['grant','start','end'].includes(values.phase)) throw new Error('--phase grant|start|end required.');
 if(command==='background'&&(!identifier.test(values.id??'')||!!values.enabled===!!values.disabled)) throw new Error('--id and exactly one of --enabled/--disabled required.');
 const url=process.env.SUPABASE_URL??process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the private operator environment, or use the connected Supabase tool per the operations guide.');
 const base=new URL(url);
 if(base.protocol!=='https:')throw new Error('HTTPS required.');
 const rpc=async(name,body)=>{
  const response=await fetch(new URL(`/rest/v1/rpc/${name}`,base),{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const result=await response.json();
  if(!response.ok)throw new Error(`Server rejected operation (${response.status}, ${result.code??'unknown'}): ${result.message??'check configuration'}`);
  return result;
 };
 let job=values.job;
 if(command==='schedule')job=(await rpc('admin_schedule_event',{p_request:request})).id;
 if(command==='cancel')await rpc('admin_cancel_event',{p_job:job});
 if(command==='recover')await rpc('admin_recover_event',{p_job:job,p_phase:values.phase});
 if(command==='background')await rpc('admin_enable_event_background',{p_id:values.id,p_enabled:!!values.enabled});
 const report=await rpc('admin_event_report',{p_job:job??null});
 console.log(JSON.stringify(values.details?report:summarizeReport(report),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(error=>{console.error(error.message);process.exitCode=1;});
