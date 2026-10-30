// Trusted operator CLI. No credential values are accepted in arguments or printed.
import {parseArgs} from 'node:util';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {artworkUrl,artworkRevision,artworkId} from '../../src/lib/artwork-content.ts';
import {main as artworkMain} from './manage-artwork.mjs';
// Compatibility export; image operations are implemented by the common artwork tool.
export {preparePostit} from './manage-artwork.mjs';
export async function main(argv=process.argv.slice(2)){
 const legacyCommand=argv[0];
 if(['prepare','upload','register','list'].includes(legacyCommand)){
  console.error('Image operations moved to manage-artwork.mjs; forwarding this compatibility command.');
  return artworkMain(argv);
 }
 const {values,positionals}=parseArgs({args:argv,allowPositionals:true,options:{request:{type:'string'},id:{type:'string'},design:{type:'string'},help:{type:'boolean'}}});
 const [command]=positionals;
 if(!command||values.help){console.log('Usage: reward --request FILE | report [--id RULE_UUID] | cancel --id RULE_UUID | enable|disable --design ID\nImages: manage-artwork.mjs prepare|upload|register|verify|list (legacy image commands still forward there).');return;}
 if(!['reward','report','cancel','enable','disable'].includes(command))throw Error('Unknown command');
 const base=process.env.SUPABASE_URL??process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)throw Error('Private operator environment required');
 artworkUrl(base,{path:'check/postits/paper.png',sha256:'a'.repeat(64)});
 const headers={apikey:key,Authorization:`Bearer ${key}`};
 const rpc=async(name,args)=>{const r=await fetch(new URL(`/rest/v1/rpc/${name}`,base),{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Operation failed (${r.status}); retry the same input after checking the server.`);return r.json();};
 let result;
 if(command==='reward'){
  if(!values.request)throw Error('Reward request JSON required');
  result=await rpc('admin_configure_postit_reward',{p_request:JSON.parse(await readFile(values.request,'utf8'))});
 }else if(command==='report'||command==='cancel'){
  if((command==='cancel'||values.id)&&!artworkRevision.test(values.id??''))throw Error('Rule UUID required');
  result=await rpc('admin_postit_reward_report',{p_id:values.id??null,p_cancel:command==='cancel'});
 }else if(command==='enable'||command==='disable'){
  if(!artworkId.test(values.design??''))throw Error('Design ID required');
  result=await rpc('admin_set_postit_design_enabled',{p_id:values.design,p_enabled:command==='enable'});
 }
 console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
