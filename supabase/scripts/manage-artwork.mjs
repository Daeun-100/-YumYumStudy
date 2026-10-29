// Trusted operator only; service keys never appear in command arguments or manifests.
import {parseArgs} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {decodeArtwork,artworkUrl,artworkRevision} from '../../src/lib/artwork-content.ts';
import {inspectPng} from './artwork-png.mjs';
export async function prepareDefinition(config,homeBytes,focusBytes){
 const manifest=decodeArtwork({...config,
  home:{path:`${config.kind}/${config.id}/${config.revision}/home.png`,...inspectPng(homeBytes,{kind:config.kind,screen:'home'})},
  focus:{path:`${config.kind}/${config.id}/${config.revision}/focus.png`,...inspectPng(focusBytes,{kind:config.kind,screen:'focus'})},
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
 if(file.length!==asset.bytes||createHash('sha256').update(file).digest('hex')!==asset.sha256)throw Error('Existing/uploaded object does not match revision.');
}
export async function uploadDefinition({base,key,manifest,homeBytes,focusBytes,request=fetch}){
 const headers={apikey:key,Authorization:`Bearer ${key}`};
 for(const [screen,bytes] of [['home',homeBytes],['focus',focusBytes]]){
  const asset=manifest[screen],url=new URL(`/storage/v1/object/event-artwork/${asset.path}`,base);
  const response=await request(url,{method:'POST',headers:{...headers,'Content-Type':'image/png','cache-control':'max-age=31536000','x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(60000)});
  if(!response.ok&&![400,409].includes(response.status))throw Error(`Upload failed (${response.status}). Draft not published.`);
  // Also handles an ambiguous earlier upload: never overwrite an immutable URL.
  await verifyArtworkFile(base,asset,request);
 }
 const response=await request(new URL('/rest/v1/rpc/admin_stage_artwork',base),{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({p_definition:manifest}),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`Staging failed (${response.status}). Uploaded files remain unpublished; retry the same revision.`);
 return response.json();
}
export async function main(argv=process.argv.slice(2)){
 const {values,positionals}=parseArgs({args:argv,allowPositionals:true,options:{definition:{type:'string'},home:{type:'string'},focus:{type:'string'},out:{type:'string'},revision:{type:'string'},activate:{type:'boolean'},help:{type:'boolean'}}});
 const [command]=positionals;
 if(!command||values.help){console.log('Usage: node --experimental-strip-types supabase/scripts/manage-artwork.mjs prepare|upload --definition FILE --home PNG --focus PNG [--out MANIFEST] | verify --definition MANIFEST | publish --revision UUID [--activate] | list [--revision UUID]');return;}
 if(!['prepare','upload','verify','publish','list'].includes(command))throw Error('Unknown artwork command.');
 let manifest,homeBytes,focusBytes;
 if(['prepare','upload'].includes(command)){
  if(!values.definition||!values.home||!values.focus)throw Error('Definition, home and focus files are required.');
  const config=JSON.parse(await readFile(values.definition,'utf8'));
  homeBytes=await readFile(values.home);focusBytes=await readFile(values.focus);manifest=await prepareDefinition(config,homeBytes,focusBytes);
  if(values.out)await writeFile(values.out,JSON.stringify(manifest,null,2)+'\n');
  if(command==='prepare'){console.log(JSON.stringify(manifest,null,2));return;}
 }
 if(values.revision&&!artworkRevision.test(values.revision)||command==='publish'&&!values.revision)throw Error('Revision UUID required.');
 const base=process.env.SUPABASE_URL??process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(command==='verify'){
  if(!base||!values.definition)throw Error('SUPABASE_URL and manifest required.');
  const m=decodeArtwork(JSON.parse(await readFile(values.definition,'utf8')));
  await Promise.all([verifyArtworkFile(base,m.home),verifyArtworkFile(base,m.focus)]);console.log(JSON.stringify({revision:m.revision,verified:true}));return;
 }
 if(!base||!key)throw Error('Private operator SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required; prepare works offline.');
 // Validate the fixed host before sending any credential.
 artworkUrl(base,{path:'skin/check/00000000-0000-4000-8000-000000000000/home.png'});
 if(command==='upload'){await uploadDefinition({base,key,manifest,homeBytes,focusBytes});console.log(JSON.stringify({revision:manifest.revision,id:manifest.id,state:'draft'}));return;}
 const name=command==='publish'?'admin_publish_artwork':'admin_artwork_report';
 const response=await fetch(new URL(`/rest/v1/rpc/${name}`,base),{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_revision:values.revision??null,...(command==='publish'?{p_activate:!!values.activate}:{})}),signal:AbortSignal.timeout(30000)});
 const result=await response.json();if(!response.ok)throw Error(`Artwork operation failed (${response.status}): ${result.message??'check server'}`);
 console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
