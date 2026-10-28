import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { createECDH } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { authorized, parseInput, deliverAll } from './core.ts';
import type { Device, Result } from './core.ts';
import { validExpoToken, validWebSubscription } from '../call-friend/validation.ts';
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const env = (name: string) => Deno.env.get(name);
const url = env('SUPABASE_URL')!;
const db = createClient(url,env('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
function webReady() {
  try {
    const pub=env('WEB_PUSH_PUBLIC_KEY'), priv=env('WEB_PUSH_PRIVATE_KEY');
    if (!pub || !priv) return false;
    const pair=createECDH('prime256v1'); pair.setPrivateKey(Buffer.from(priv,'base64url'));
    return pair.getPublicKey().toString('base64url') === pub.replace(/=+$/,'');
  } catch { return false; }
}
async function readInput(req: Request) {
  const reader=req.body?.getReader(); if(!reader) throw Error('Body required');
  let size=0; const chunks:Uint8Array[]=[];
  while(true){ const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();throw Error('Too large');}chunks.push(value); }
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  return parseInput(JSON.parse(new TextDecoder().decode(bytes)));
}
Deno.serve(async req => {
  if(req.method!=='POST') return reply({error:'POST required'},405);
  if(!await authorized(req.headers.get('x-admin-notification-token'),env('ADMIN_NOTIFICATION_TOKEN'))) return reply({error:'Unauthorized'},401);
  let input;try{input=await readInput(req);}catch{return reply({error:'Invalid request'},400);}
  try {
    if(input.action==='status') {
      const {data,error}=await db.from('admin_notification_dispatches').select('id,status,summary,results,created_at').eq('id',input.id).maybeSingle();
      if(error)throw error;return data?reply(data):reply({error:'Not found'},404);
    }
    let query=db.from('profiles').select('id,display_name').eq('room_id',input.roomId).eq('name_confirmed',true).not('invite_verified_at','is',null).order('id').limit(101);
    if(input.userIds)query=query.in('id',input.userIds);
    const {data:profiles,error:pe}=await query;if(pe)throw pe;
    if(!profiles?.length || profiles.length>100 || (input.userIds && profiles.length!==input.userIds.length))return reply({error:'Recipients missing or exceed limit'},400);
    const {data:rows,error:de}=await db.from('friend_call_devices').select('id,user_id,provider,address').in('user_id',profiles.map(p=>p.id)).eq('enabled',true).order('id').limit(101);
    if(de)throw de;if((rows?.length??0)>100)return reply({error:'Device limit exceeded'},400);
    const devices=(rows??[]) as Device[], ready=webReady();
    const summary={roomId:input.roomId,users:profiles.length,devices:devices.length,expo:devices.filter(d=>d.provider==='expo').length,web:devices.filter(d=>d.provider==='web').length,webConfigured:ready,unregistered:profiles.filter(p=>!devices.some(d=>d.user_id===p.id)).map(p=>p.display_name)};
    if(input.action==='preview')return reply({id:input.id,mode:'preview',...summary});
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({roomId:input.roomId,title:input.title,body:input.body,userIds:input.userIds})));
    const payloadHash=Buffer.from(hash).toString('hex');
    const {error:reserveError}=await db.from('admin_notification_dispatches').insert({id:input.id,payload_hash:payloadHash,status:'sending',summary});
    if(reserveError){
      if(reserveError.code!=='23505')throw reserveError;
      const {data:old,error}=await db.from('admin_notification_dispatches').select('id,payload_hash,status,summary,results').eq('id',input.id).single();
      if(error)throw error;if(old.payload_hash!==payloadHash)return reply({error:'ID used with different content'},409);
      return reply({id:old.id,status:old.status,summary:old.summary,results:old.results,replayed:true});
    }
    const persist=async(results:Result[])=>{const {error}=await db.from('admin_notification_dispatches').update({results}).eq('id',input.id);if(error)throw error;};
    const results=await deliverAll(devices,async device=>{
      if(device.provider==='web'){
        if(!ready)return {status:'configuration-required'};
        if(!validWebSubscription(device.address))return {status:'failed',errorCode:'InvalidSubscription'};
        try{
          await webpush.sendNotification(device.address,JSON.stringify({title:input.title,body:input.body,roomId:input.roomId,callId:input.id}),{TTL:86400,urgency:'high',timeout:12000,vapidDetails:{subject:url,publicKey:env('WEB_PUSH_PUBLIC_KEY')!,privateKey:env('WEB_PUSH_PRIVATE_KEY')!}});
          return {status:'accepted'};
        }catch(e){const code=(e as {statusCode?:number}).statusCode;return {status:code?'failed':'unknown',errorCode:code?String(code):'Network',invalid:code===404||code===410};}
      }
      if(!validExpoToken(device.address))return {status:'failed',errorCode:'InvalidExpoToken'};
      const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json',...(env('EXPO_ACCESS_TOKEN')?{Authorization:`Bearer ${env('EXPO_ACCESS_TOKEN')}`}:{})},body:JSON.stringify({to:device.address,title:input.title,body:input.body,sound:'default',priority:'high',channelId:'friend-calls',ttl:86400,data:{type:'admin-announcement',roomId:input.roomId,announcementId:input.id}})});
      if(!response.ok)return {status:response.status>=500?'unknown':'failed',errorCode:String(response.status)};
      const {data}=await response.json();
      return data?.status==='ok'?{status:'accepted',ticketId:data.id}:{status:'failed',errorCode:String(data?.details?.error??'PushError'),invalid:data?.details?.error==='DeviceNotRegistered'};
    },persist);
    for(const r of results.filter(r=>r.invalid))await db.from('friend_call_devices').update({enabled:false}).eq('id',r.deviceId).eq('user_id',r.userId);
    const {error}=await db.from('admin_notification_dispatches').update({status:'completed',results}).eq('id',input.id);if(error)throw error;
    return reply({id:input.id,status:'completed',summary,results});
  }catch{return reply({error:'Outcome unknown; query status with the same ID. Do not resend.'},500);}
});
