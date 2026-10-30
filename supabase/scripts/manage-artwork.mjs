// Trusted operator only; service keys never appear in command arguments or manifests.
import {parseArgs} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {decodeArtwork,artworkUrl} from '../../src/lib/artwork-content.ts';
import {decodePostitDefinition} from '../../src/features/postits/designs.ts';
import {inspectPng} from './artwork-png.mjs';
export function preparePostit(config,bytes,previewBytes){
 const path=config.paper?.path??`${config.theme}/postits/${config.id}/paper.png`;
 if(config.preview&&!previewBytes)throw Error('Preview PNG file required with preview definition');
 return decodePostitDefinition({...config,schemaVersion:2,kind:'postit',paper:{path,...inspectPng(bytes,{kind:'postit',screen:'paper'})},...(previewBytes?{preview:{path:config.preview?.path??`${config.theme}/postits/${config.id}/preview.png`,...inspectPng(previewBytes,{kind:'postit',screen:'preview'})}}:{})});
}
export const decodeDefinition = value => value?.kind === 'postit' ? decodePostitDefinition(value) : decodeArtwork(value);
export const definitionFiles = manifest => manifest.kind === 'postit' ? [manifest.paper, ...(manifest.preview ? [manifest.preview] : [])] : [manifest.home, manifest.focus];
export async function prepareDefinition(config,homeBytes,focusBytes){
 if(config.schemaVersion!==undefined&&config.schemaVersion!==2 || 'revision' in config)throw Error('Only themed artwork definitions are supported.');
 const id=config.id??(config.kind==='background'?`${config.theme}-room`:undefined);
 const dir=config.kind==='background'?`${config.theme}/backgrounds`:`${config.theme}/skins/${id}`;
 const path=screen=>typeof config[screen]==='string'?config[screen]:config[screen]?.path??`${dir}/${screen}.png`;
 const manifest=decodeArtwork({...config,schemaVersion:2,id,
  home:{path:path('home'),...inspectPng(homeBytes,{kind:config.kind,screen:'home'})},
  focus:{path:path('focus'),...inspectPng(focusBytes,{kind:config.kind,screen:'focus'})},
 });
 // Server rejects unsupported keys/effects; the publisher must not silently drop them.
 for(const effect of config.effects??[])if(effect.kind!=='warmSteam'||effect.version!==undefined&&effect.version!==1||Object.keys(effect).some(k=>!['kind','version','home','focus'].includes(k))
  ||['home','focus'].some(screen=>Object.keys(effect[screen]??{}).some(k=>!['x','y','width','opacity'].includes(k))))throw Error('Unsupported effect or parameter.');
 if(config.kind==='background'&&manifest.effects.length)throw Error('Background effects are not supported.');
 return manifest;
}
export async function verifyArtworkFile(base,asset,request=fetch){
 const verified=await request(artworkUrl(base,asset),{signal:AbortSignal.timeout(60000)});
 if(!verified.ok||verified.headers.get('content-type')?.split(';')[0]!=='image/png')throw Error('Uploaded PNG cannot be verified.');
 const file=Buffer.from(await verified.arrayBuffer());
 if(file.length!==asset.bytes||createHash('sha256').update(file).digest('hex')!==asset.sha256)throw Error('Existing/uploaded object does not match registered image.');
}
export async function uploadDefinition({base,key,manifest,homeBytes,focusBytes,paperBytes,previewBytes,activate=false,replace=false,request=fetch}){
 manifest=decodeDefinition(manifest);
 const files=definitionFiles(manifest);
 for(const asset of files)artworkUrl(base,asset);
 if(manifest.kind==='postit'&&replace)throw Error('Postit images are preserved; use a new file path instead of --replace.');
 const headers={apikey:key,Authorization:`Bearer ${key}`};
 const bytesByFile=manifest.kind==='postit'?[paperBytes,...(manifest.preview?[previewBytes]:[])]:[homeBytes,focusBytes];
 for(const [index,asset] of files.entries()){
  const bytes=bytesByFile[index],url=new URL(`/storage/v1/object/event-artwork/${asset.path}`,base);
  const response=await request(url,{method:'POST',headers:{...headers,'Content-Type':'image/png','cache-control':manifest.kind==='postit'?'max-age=31536000':'max-age=3600','x-upsert':replace?'true':'false'},body:bytes,signal:AbortSignal.timeout(60000)});
  if(!response.ok&&![400,409].includes(response.status))throw Error(`Upload failed (${response.status}). Artwork not registered.`);
  // Also handles an ambiguous earlier upload: only reuse existing objects when their verified bytes match.
  await verifyArtworkFile(base,asset,request);
 }
 const response=await request(new URL('/rest/v1/rpc/admin_register_artwork',base),{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({p_definition:manifest,p_activate:activate}),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`Registration failed (${response.status}). Uploaded files remain unregistered; retry the same definition.`);
 return response.json();
}
export async function main(argv=process.argv.slice(2)){
 const {values,positionals}=parseArgs({args:argv,allowPositionals:true,options:{definition:{type:'string'},home:{type:'string'},focus:{type:'string'},paper:{type:'string'},preview:{type:'string'},out:{type:'string'},activate:{type:'boolean'},replace:{type:'boolean'},theme:{type:'string'},help:{type:'boolean'}}});
 const [command]=positionals;
 if(!command||values.help){console.log('Usage: node --experimental-strip-types supabase/scripts/manage-artwork.mjs prepare|upload --definition FILE (--home PNG --focus PNG | --paper PNG [--preview PNG]) [--out MANIFEST] [--activate] [--replace] | register --definition MANIFEST [--activate] | verify --definition MANIFEST | list [--theme THEME]');return;}
 if(!['prepare','upload','verify','register','list'].includes(command))throw Error('Unknown artwork command.');
 let manifest,homeBytes,focusBytes,paperBytes,previewBytes;
 if(['prepare','upload'].includes(command)){
  if(!values.definition)throw Error('Definition file required.');
  const config=JSON.parse(await readFile(values.definition,'utf8'));
  if(config.kind==='postit'||values.paper){
   if(config.kind&&config.kind!=='postit')throw Error('Postit definition required with --paper.');
   if(!values.paper||values.home||values.focus)throw Error('Postit requires --paper and optional --preview, without home/focus.');
   paperBytes=await readFile(values.paper);previewBytes=values.preview?await readFile(values.preview):undefined;
   manifest=preparePostit(config,paperBytes,previewBytes);
  }else{
   if(!values.home||!values.focus||values.paper||values.preview)throw Error('Background/skin requires --home and --focus, without paper/preview.');
   homeBytes=await readFile(values.home);focusBytes=await readFile(values.focus);manifest=await prepareDefinition(config,homeBytes,focusBytes);
  }
  if(values.out)await writeFile(values.out,JSON.stringify(manifest,null,2)+'\n');
  if(command==='prepare'){console.log(JSON.stringify(manifest,null,2));return;}
 }
 const base=process.env.SUPABASE_URL??process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(command==='verify'){
  if(!base||!values.definition)throw Error('SUPABASE_URL and manifest required.');
  const m=decodeDefinition(JSON.parse(await readFile(values.definition,'utf8')));
  await Promise.all(definitionFiles(m).map(asset=>verifyArtworkFile(base,asset)));console.log(JSON.stringify({id:m.id,theme:m.theme,verified:true}));return;
 }
 if(!base||!key)throw Error('Private operator SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required; prepare works offline.');
 // Validate the fixed host before sending any credential.
 artworkUrl(base,{path:'check/backgrounds/home.png',sha256:'0'.repeat(64)});
 if(command==='upload'){await uploadDefinition({base,key,manifest,homeBytes,focusBytes,paperBytes,previewBytes,activate:!!values.activate,replace:!!values.replace});console.log(JSON.stringify({id:manifest.id,theme:manifest.theme,state:'registered'}));return;}
 if(command==='register'){
  if(!values.definition)throw Error('Manifest required.');
  manifest=decodeDefinition(JSON.parse(await readFile(values.definition,'utf8')));
  await Promise.all(definitionFiles(manifest).map(asset=>verifyArtworkFile(base,asset)));
 }
 const name=command==='register'?'admin_register_artwork':'admin_artwork_library';
 const response=await fetch(new URL(`/rest/v1/rpc/${name}`,base),{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(command==='register'?{p_definition:manifest,p_activate:!!values.activate}:{p_theme:values.theme??null}),signal:AbortSignal.timeout(30000)});
 const result=await response.json();if(!response.ok)throw Error(`Artwork operation failed (${response.status}): ${result.message??'check server'}`);
 console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
