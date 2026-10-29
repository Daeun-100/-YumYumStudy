// Trusted operator CLI. No credential values are accepted in arguments or printed.
import {parseArgs} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {decodePostitArtwork,decodePostitDefinition} from '../../src/features/postits/designs.ts';
import {artworkUrl,artworkRevision,artworkId} from '../../src/lib/artwork-content.ts';
import {inspectPng} from './artwork-png.mjs';
import {verifyArtworkFile} from './manage-artwork.mjs';
export function preparePostit(config,bytes){
 const legacy=!!config.revision && config.schemaVersion!==2;
 const schemaVersion=legacy?1:2;
 const path=legacy?`postit/${config.id}/${config.revision}/paper.png`:config.paper?.path??`${config.theme}/postits/${config.id}/paper.png`;
 const definition={...config,schemaVersion,kind:'postit',paper:{path,...inspectPng(bytes,{kind:'postit',screen:'paper'})}};
 return legacy?decodePostitArtwork(definition):decodePostitDefinition(definition);
}
export async function main(argv=process.argv.slice(2)){
 const {values,positionals}=parseArgs({args:argv,allowPositionals:true,options:{definition:{type:'string'},paper:{type:'string'},out:{type:'string'},theme:{type:'string'},revision:{type:'string'},activate:{type:'boolean'},request:{type:'string'},id:{type:'string'},design:{type:'string'},help:{type:'boolean'}}});
 const [command]=positionals;
 if(!command||values.help){console.log('Usage: prepare|upload --definition FILE --paper PNG [--out MANIFEST] [--activate] | register --definition MANIFEST [--activate] | reward --request FILE | report [--id RULE_UUID] | cancel --id RULE_UUID | list [--theme THEME] | enable|disable --design ID');return;}
 if(!['prepare','upload','register','publish','reward','report','cancel','list','enable','disable'].includes(command))throw Error('Unknown command');
 let manifest,bytes;
 if(['prepare','upload'].includes(command)){
  if(!values.definition||!values.paper)throw Error('Definition and paper PNG required');
  const config=JSON.parse(await readFile(values.definition,'utf8'));
  bytes=await readFile(values.paper);manifest=preparePostit(config,bytes);
  if(values.out)await writeFile(values.out,JSON.stringify(manifest,null,2)+'\n');
  if(command==='prepare'){console.log(JSON.stringify(manifest,null,2));return;}
 }
 const base=process.env.SUPABASE_URL??process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)throw Error('Private operator environment required; prepare works offline');
 artworkUrl(base,{path:'postit/check/00000000-0000-4000-8000-000000000000/paper.png'});
 const headers={apikey:key,Authorization:`Bearer ${key}`};
 const rpc=async(name,args)=>{const r=await fetch(new URL(`/rest/v1/rpc/${name}`,base),{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Operation failed (${r.status}); retry the same input after checking the server.`);return r.json();};
 let result;
 if(command==='upload'){
  const r=await fetch(new URL(`/storage/v1/object/event-artwork/${manifest.paper.path}`,base),{method:'POST',headers:{...headers,'Content-Type':'image/png','cache-control':'max-age=31536000','x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(60000)});
  if(!r.ok&&![400,409].includes(r.status))throw Error(`Upload failed (${r.status})`);
  await verifyArtworkFile(base,manifest.paper);result=await rpc(manifest.schemaVersion===2?'admin_register_artwork':'admin_stage_artwork',{p_definition:manifest,...(manifest.schemaVersion===2?{p_activate:!!values.activate}:{})});
 }else if(command==='register'){
  if(!values.definition)throw Error('Manifest required');
  manifest=decodePostitDefinition(JSON.parse(await readFile(values.definition,'utf8')));
  await verifyArtworkFile(base,manifest.paper);
  result=await rpc('admin_register_artwork',{p_definition:manifest,p_activate:!!values.activate});
 }else if(command==='publish'){
  if(!artworkRevision.test(values.revision??''))throw Error('Revision UUID required');
  const report=await rpc('admin_artwork_report',{p_revision:values.revision});
  const definition=decodePostitArtwork(report.revisions?.[0]?.definition);
  await verifyArtworkFile(base,definition.paper);
  result=await rpc('admin_publish_artwork',{p_revision:values.revision,p_activate:!!values.activate});
 }else if(command==='reward'){
  if(!values.request)throw Error('Reward request JSON required');
  result=await rpc('admin_configure_postit_reward',{p_request:JSON.parse(await readFile(values.request,'utf8'))});
 }else if(command==='report'||command==='cancel'){
  if((command==='cancel'||values.id)&&!artworkRevision.test(values.id??''))throw Error('Rule UUID required');
  result=await rpc('admin_postit_reward_report',{p_id:values.id??null,p_cancel:command==='cancel'});
 }else if(command==='enable'||command==='disable'){
  if(!artworkId.test(values.design??''))throw Error('Design ID required');
  result=await rpc('admin_set_postit_design_enabled',{p_id:values.design,p_enabled:command==='enable'});
 }else{
  if(values.revision&&!artworkRevision.test(values.revision))throw Error('Revision UUID required');
  result=await rpc('admin_artwork_library',{p_theme:values.theme??null});
 }
 console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
