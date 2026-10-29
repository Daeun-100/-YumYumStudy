// Trusted operator CLI. No credential values are accepted in arguments or printed.
import {parseArgs} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {decodePostitDefinition} from '../../src/features/postits/designs.ts';
import {artworkUrl,artworkRevision,artworkId} from '../../src/lib/artwork-content.ts';
import {inspectPng} from './artwork-png.mjs';
import {verifyArtworkFile} from './manage-artwork.mjs';
export function preparePostit(config,bytes,previewBytes){
 const path=config.paper?.path??`${config.theme}/postits/${config.id}/paper.png`;
 if(config.preview&&!previewBytes)throw Error('Preview PNG file required with preview definition');
 return decodePostitDefinition({...config,schemaVersion:2,kind:'postit',paper:{path,...inspectPng(bytes,{kind:'postit',screen:'paper'})},...(previewBytes?{preview:{path:config.preview?.path??`${config.theme}/postits/${config.id}/preview.png`,...inspectPng(previewBytes,{kind:'postit',screen:'preview'})}}:{})});
}
export async function main(argv=process.argv.slice(2)){
 const {values,positionals}=parseArgs({args:argv,allowPositionals:true,options:{definition:{type:'string'},paper:{type:'string'},preview:{type:'string'},out:{type:'string'},theme:{type:'string'},activate:{type:'boolean'},request:{type:'string'},id:{type:'string'},design:{type:'string'},help:{type:'boolean'}}});
 const [command]=positionals;
 if(!command||values.help){console.log('Usage: prepare|upload --definition FILE --paper PNG [--preview PNG] [--out MANIFEST] [--activate] | register --definition MANIFEST [--activate] | reward --request FILE | report [--id RULE_UUID] | cancel --id RULE_UUID | list [--theme THEME] | enable|disable --design ID');return;}
 if(!['prepare','upload','register','reward','report','cancel','list','enable','disable'].includes(command))throw Error('Unknown command');
 let manifest,bytes,previewBytes;
 if(['prepare','upload'].includes(command)){
  if(!values.definition||!values.paper)throw Error('Definition and paper PNG required');
  const config=JSON.parse(await readFile(values.definition,'utf8'));
  bytes=await readFile(values.paper);previewBytes=values.preview?await readFile(values.preview):undefined;manifest=preparePostit(config,bytes,previewBytes);
  if(values.out)await writeFile(values.out,JSON.stringify(manifest,null,2)+'\n');
  if(command==='prepare'){console.log(JSON.stringify(manifest,null,2));return;}
 }
 const base=process.env.SUPABASE_URL??process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)throw Error('Private operator environment required; prepare works offline');
 artworkUrl(base,{path:'check/postits/paper.png',sha256:'a'.repeat(64)});
 const headers={apikey:key,Authorization:`Bearer ${key}`};
 const rpc=async(name,args)=>{const r=await fetch(new URL(`/rest/v1/rpc/${name}`,base),{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Operation failed (${r.status}); retry the same input after checking the server.`);return r.json();};
 let result;
 if(command==='upload'){
  for(const [asset,file] of [[manifest.paper,bytes],...(manifest.preview?[[manifest.preview,previewBytes]]:[])]){
   const r=await fetch(new URL(`/storage/v1/object/event-artwork/${asset.path}`,base),{method:'POST',headers:{...headers,'Content-Type':'image/png','cache-control':'max-age=31536000','x-upsert':'false'},body:file,signal:AbortSignal.timeout(60000)});
   if(!r.ok&&![400,409].includes(r.status))throw Error(`Upload failed (${r.status})`);
   await verifyArtworkFile(base,asset);
  }
  result=await rpc('admin_register_artwork',{p_definition:manifest,p_activate:!!values.activate});
 }else if(command==='register'){
  if(!values.definition)throw Error('Manifest required');
  manifest=decodePostitDefinition(JSON.parse(await readFile(values.definition,'utf8')));
  await Promise.all([manifest.paper,...(manifest.preview?[manifest.preview]:[])].map(asset=>verifyArtworkFile(base,asset)));
  result=await rpc('admin_register_artwork',{p_definition:manifest,p_activate:!!values.activate});
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
  result=await rpc('admin_artwork_library',{p_theme:values.theme??null});
 }
 console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
