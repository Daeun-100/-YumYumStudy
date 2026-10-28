import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
export const endpoint='https://hxwwhgxxvyzqqnxlgqde.supabase.co/functions/v1/admin-notifications';
export async function request(action,input,config,fetcher=fetch){
  if(!['preview','send','status'].includes(action))throw Error('Invalid action');
  if(typeof config.token!=='string'||config.token.length<64)throw Error('Missing admin token');
  const body={...input,action};
  if(!body.id)body.id=crypto.randomUUID();
  const response=await fetcher(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(120000),headers:{'Content-Type':'application/json','x-admin-notification-token':config.token},body:JSON.stringify(body)});
  const result=await response.json();
  return {httpStatus:response.status,...result};
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==1||!['--preview','--send','--status'].includes(args[0]))throw Error('Use --preview, --send or --status with JSON stdin');
  const file=path.join(os.homedir(),'.codex','skills','yumyum-send-notification','private','admin.json');
  if(fs.statSync(file).mode&0o077)throw Error('Admin credential file must be private (0600)');
  const config=JSON.parse(fs.readFileSync(file,'utf8'));
  const input=JSON.parse(fs.readFileSync(0,'utf8'));
  if(args[0]!=='--preview'&&!input.id)throw Error('Reuse the preview request UUID');
  // Output ID before a possible timeout, so status can always be recovered.
  input.id??=crypto.randomUUID();
  console.error(JSON.stringify({requestId:input.id,action:args[0].slice(2)}));
  const result=await request(args[0].slice(2),input,config);
  console.log(JSON.stringify(result));
  if(result.httpStatus>=400)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(()=>{console.error('Request failed. Do not resend; use --status with the same requestId. Check local credentials if no request was sent.');process.exitCode=1;});
