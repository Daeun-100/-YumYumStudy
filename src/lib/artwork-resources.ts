import { artworkReference, artworkSignature, decodeArtwork, type ArtworkManifest, type ArtworkFile } from './artwork-content.ts';
export type ArtworkEntry = { manifest?: ArtworkManifest; state: 'loading' | 'ready' | 'failed' | 'unsupported'; checkedAt: number };
type Deps = { fetchSkins(ids: string[]): Promise<unknown[]>; prepare(manifest: ArtworkManifest): Promise<void>; now(): number; url?(asset: ArtworkFile): string; save?(manifests: ArtworkManifest[]): void };
/** One store per identity + room. Responses from disposed stores cannot cross scopes. */
export function createArtworkResources(deps: Deps) {
 let snapshot: ReadonlyMap<string,ArtworkEntry> = new Map(), disposed = false;
 const listeners = new Set<()=>void>(), pending = new Map<string,Promise<void>>();
 const requested = new Set<string>(), trailing = new Set<string>();
 const wanted = new Map<string,string>(), demand = new Map<string,number>();
 const emit = (key: string,entry: ArtworkEntry) => {
  if (disposed) return;
  snapshot = new Map(snapshot).set(key,entry); listeners.forEach(l=>l());
 };
 const save = () => deps.save?.([...snapshot.values()].filter(e=>e.state==='ready').map(e=>e.manifest!));
 const ingest = (raw: unknown, restore = false): Promise<void> => {
  let manifest: ArtworkManifest;
  try {manifest = decodeArtwork(raw);} catch {return Promise.resolve();}
  const key = manifest.kind === 'skin' ? `skin:${manifest.id}` : `background:${artworkReference(manifest)}`;
  const old = snapshot.get(key);
  if (restore && old && old.state !== 'failed' && !(old.state === 'loading' && !old.manifest) || old?.state==='ready' && old.manifest && artworkSignature(old.manifest)===artworkSignature(manifest)) return Promise.resolve();
  wanted.set(key,artworkSignature(manifest));
  const preparingKey = `${key}:${artworkSignature(manifest)}`;
  const existing = pending.get(preparingKey); if (existing) return existing;
  // Keep a verified previous image on screen until the replacement is decoded.
  if (!old || old.state !== 'ready') emit(key,{manifest,state:'loading',checkedAt:deps.now()});
  const task = (async()=>{
   try {await deps.prepare(manifest);if (!disposed && wanted.get(key)===artworkSignature(manifest)) {emit(key,{manifest,state:'ready',checkedAt:deps.now()});save();}}
   catch {if (wanted.get(key)===artworkSignature(manifest) && (!old || old.state!=='ready')) emit(key,{manifest,state:'failed',checkedAt:deps.now()});}
  })().finally(()=>pending.delete(preparingKey));
  pending.set(preparingKey,task);return task;
 };
 const requestSkins = async (ids: (string|null|undefined)[], force = false) => {
  if(disposed) return;
  const needed=[...new Set(ids.filter((id): id is string=>typeof id==='string'&&/^[a-z0-9][a-z0-9_-]{0,79}$/.test(id)))].filter(id=>{
   requested.add(id);if(force&&pending.has(`fetch:${id}`))trailing.add(id);const entry=snapshot.get(`skin:${id}`);
   return !pending.has(`fetch:${id}`) && (force || !entry || deps.now()-entry.checkedAt>=60000);
  });
  for(let at=0;at<needed.length;at+=32){
   const batch=needed.slice(at,at+32);
   const run=(async()=>{
    try {
     const raw=await deps.fetchSkins(batch);if(disposed)return;
     const received=new Set<string>();const work: Promise<void>[]=[];
     for(const row of raw){try {const m=decodeArtwork(row);if(m.kind!=='skin'||!batch.includes(m.id))continue;received.add(m.id);work.push(ingest(row));}catch{/* Unsupported metadata stays unavailable. */}}
     for(const id of batch)if(!received.has(id)){wanted.delete(`skin:${id}`);emit(`skin:${id}`,{state:'unsupported',checkedAt:deps.now()});}
     await Promise.all(work);
    }catch {for(const id of batch)if(snapshot.get(`skin:${id}`)?.state!=='ready')emit(`skin:${id}`,{state:'failed',checkedAt:deps.now()});}
   })();
   for(const id of batch){pending.set(`fetch:${id}`,run);if(!snapshot.has(`skin:${id}`))emit(`skin:${id}`,{state:'loading',checkedAt:deps.now()});}
   await run;for(const id of batch)pending.delete(`fetch:${id}`);
   const follow=batch.filter(id=>trailing.delete(id)&&requested.has(id));if(follow.length&&!disposed)void requestSkins(follow,true);
  }
 };
 return {
  url(asset:ArtworkFile){if(!deps.url)throw Error('Artwork URL resolver required');return deps.url(asset);},
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  read:()=>snapshot, ingest, requestSkins,
  acquireSkins(ids:string[]){
   const unique=[...new Set(ids)];for(const id of unique){requested.add(id);demand.set(id,(demand.get(id)??0)+1);}
   void requestSkins(unique);let released=false;
   return()=>{if(released)return;released=true;for(const id of unique){const count=(demand.get(id)??1)-1;if(count>0)demand.set(id,count);else{demand.delete(id);requested.delete(id);}}};
  },
  refresh:()=>requestSkins([...requested],true),
  restore:async(raw:unknown)=>{if(Array.isArray(raw))await Promise.all(raw.slice(0,200).map(v=>ingest(v,true)));},
  invalidate(manifest: ArtworkManifest){const key=manifest.kind==='skin'?`skin:${manifest.id}`:`background:${artworkReference(manifest)}`;emit(key,{manifest,state:'failed',checkedAt:0});},
  activate(){disposed=false;},
  dispose(){disposed=true;listeners.clear();},
 };
}
export type ArtworkResources = ReturnType<typeof createArtworkResources>;
