import { useEffect, useMemo, type PropsWithChildren } from 'react';
import { Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIdentity } from '../../components/IdentityProvider';
import { useAppActive } from '../../hooks/useAppActive';
import { studyRoomId } from '../../lib/room';
import { getSupabase } from '../../lib/supabase';
import { callRpc } from '../../data/rpc';
import { artworkUrl, type ArtworkFile } from '../../lib/artwork-content';
import { createArtworkResources } from '../../lib/artwork-resources';
import { ArtworkContext } from './ArtworkContext';

// Sharing these public artwork downloads across stores does not share entitlements.
const downloads = new Map<string,Promise<void>>();
let running = 0;
const queue: (()=>void)[] = [];
async function prepareImage(asset: ArtworkFile) {
 const uri=artworkUrl(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',asset);
 const existing=downloads.get(uri);if(existing)return existing;
 const task=(async()=>{
  if(running>=4)await new Promise<void>(resolve=>queue.push(resolve));else running++;
  try {
   let timer:ReturnType<typeof setTimeout>|undefined;
   try {
    await Promise.race([
     (async()=>{if(!await Image.prefetch(uri))throw Error('Image unavailable');
      const size=await new Promise<{width:number;height:number}>((resolve,reject)=>Image.getSize(uri,(width,height)=>resolve({width,height}),reject));
      if(size.width!==asset.width||size.height!==asset.height)throw Error('Image dimensions changed');})(),
     new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Image download timed out')),20000);}),
    ]);
   }finally{clearTimeout(timer);}
  }finally{const next=queue.shift();if(next)next();else running--;}
 })().finally(()=>downloads.delete(uri));
 downloads.set(uri,task);return task;
}
let channelSequence=0;
export function ArtworkProvider({children}:PropsWithChildren) {
 const identity=useIdentity(),active=useAppActive(),room=studyRoomId;
 const owner=identity.profile?.id;
 const resources=useMemo(()=>createArtworkResources({
  now:Date.now,
  url:asset=>artworkUrl(process.env.EXPO_PUBLIC_SUPABASE_URL??'',asset),
  fetchSkins:async ids=>{const result=await callRpc('get_skin_artwork',{p_ids:ids,p_room_id:room});if(!Array.isArray(result))throw Error('Invalid artwork response');return result;},
  prepare:async m=>{await Promise.all([prepareImage(m.home),prepareImage(m.focus)]);},
  save:manifests=>{if(owner)void AsyncStorage.setItem(`artwork-v1:${owner}:${room}`,JSON.stringify(manifests.slice(-200))).catch(()=>{});},
 }),[owner,room]);
 useEffect(()=>{
  let mounted=true;
  resources.activate();
  if(owner)void AsyncStorage.getItem(`artwork-v1:${owner}:${room}`).then(text=>{if(mounted&&text){try{void resources.restore(JSON.parse(text));}catch{/* Bad cache is replaceable. */}}}).catch(()=>{});
  return()=>{mounted=false;resources.dispose();};
 },[resources,owner,room]);
 useEffect(()=>{
  if(!active||!owner)return;
  void resources.refresh();
  const client=getSupabase();
  const channel=client.channel(`artwork-${++channelSequence}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'event_background_versions',filter:`room_id=eq.${room}`},()=>{void resources.refresh();})
   .subscribe(status=>{if(status==='SUBSCRIBED')void resources.refresh();});
  return()=>{void client.removeChannel(channel).catch(()=>{});};
 },[resources,active,owner,room]);
 return <ArtworkContext.Provider value={resources}>{children}</ArtworkContext.Provider>;
}
