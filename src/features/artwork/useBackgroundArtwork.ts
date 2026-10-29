import { useContext, useSyncExternalStore } from 'react';
import { ArtworkContext } from './ArtworkContext';
import { resolveBackgroundArtwork } from '../../design/background-artwork';
import type { ArtworkEntry } from '../../lib/artwork-resources';
const empty:ReadonlyMap<string,ArtworkEntry>=new Map();
const noSubscribe=()=>()=>{},readEmpty=()=>empty;
export function useBackgroundArtwork(screen:'home'|'focus',id?:string){
 const store=useContext(ArtworkContext);
 const entries=useSyncExternalStore(store?.subscribe??noSubscribe,store?.read??readEmpty,readEmpty);
 const match=/^remote:([a-f0-9-]{36}|asset-[a-z0-9][a-z0-9_-]{0,79}):(home|focus)$/.exec(id??'');
 const entry=match?entries.get(`background:${match[1]}`):undefined;
 if(match?.[2]===screen&&entry?.state==='ready'&&entry.manifest){
  return {source:{uri:store!.url(entry.manifest[screen])},label:entry.manifest.name};
 }
 return resolveBackgroundArtwork(screen,id);
}
