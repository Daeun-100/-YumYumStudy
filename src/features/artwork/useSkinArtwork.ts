import { useContext, useEffect, useSyncExternalStore } from 'react';
import { ArtworkContext } from './ArtworkContext';
import { resolveCharacterArtwork as localArtwork, hasSkinArtwork as localSupport } from '../../design/skin-artwork';
import type { CharacterId } from '../../lib/characters';
import type { ArtworkEntry } from '../../lib/artwork-resources';
const empty: ReadonlyMap<string,ArtworkEntry> = new Map();
const noSubscribe=()=>()=>{};
const readEmpty=()=>empty;
export function useSkinArtwork(ids:(string|null|undefined)[]) {
 const store=useContext(ArtworkContext);
 const entries=useSyncExternalStore(store?.subscribe??noSubscribe,store?.read??readEmpty,readEmpty);
 const key=JSON.stringify([...new Set(ids.filter(Boolean))].sort());
 useEffect(()=>store?.acquireSkins(JSON.parse(key)),[store,key]);
 const resolveCharacterArtwork=(character:CharacterId='bunny',id?:string|null)=>{
  const entry=id?entries.get(`skin:${id}`):undefined;
  const m=entry?.state==='ready'?entry.manifest:undefined;
  if(m?.kind==='skin'&&m.character===character){
   return {label:m.name,home:{uri:store!.url(m.home)},focus:{uri:store!.url(m.focus)},homePlacement:m.homePlacement,focusBottom:m.focusBottom,effects:m.effects};
  }
  return localArtwork(character,id);
 };
 const hasSkinArtwork=(character:CharacterId,id?:string|null)=>localSupport(character,id)||!!id&&entries.get(`skin:${id}`)?.state==='ready'&&entries.get(`skin:${id}`)?.manifest?.character===character;
 const status=(id:string)=>entries.get(`skin:${id}`)?.state;
 return {resolveCharacterArtwork,hasSkinArtwork,status,retry:()=>{void store?.requestSkins(JSON.parse(key),true);}};
}
