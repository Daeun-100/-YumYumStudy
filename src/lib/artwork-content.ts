import { characterIds, type CharacterId } from './characters.ts';
import type { SkinEffect } from '../design/skin-effects.ts';
export const ARTWORK_BUCKET = 'event-artwork';
export const artworkId = /^[a-z0-9][a-z0-9_-]{0,79}$/;
export const artworkRevision = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export type ArtworkFile = { path: string; sha256: string; bytes: number; width: number; height: number };
export type ArtworkManifest = {
 schemaVersion: 1; revision: string; kind: 'skin' | 'background'; id: string; name: string; character?: CharacterId;
 home: ArtworkFile; focus: ArtworkFile;
 homePlacement?: { scale: number; x: number; y: number }; focusBottom?: number; effects: SkinEffect[];
};
const object = (v: unknown): Record<string, unknown> => {
 if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('Invalid artwork object');
 return v as Record<string, unknown>;
};
const number = (v: unknown, min: number, max: number): number => {
 if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw Error('Artwork value out of range');
 return v;
};
export function decodeArtwork(value: unknown): ArtworkManifest {
 const v = object(value);
 if (v.schemaVersion !== 1 || !artworkRevision.test(String(v.revision)) || (typeof v.id !== 'string' || !artworkId.test(v.id))
  || !['skin','background'].includes(String(v.kind)) || typeof v.name !== 'string' || !v.name.trim() || v.name.length > 60) throw Error('Unsupported artwork definition');
 const kind = v.kind as ArtworkManifest['kind'];
 if(kind==='background'&&!/^[a-z0-9][a-z0-9-]{0,79}$/.test(v.id as string))throw Error('Invalid background ID');
 if (kind === 'skin' && !characterIds.includes(v.character as CharacterId)) throw Error('Unsupported character');
 const file = (input: unknown, screen: 'home' | 'focus'): ArtworkFile => {
  const a = object(input), expected = screen === 'home' ? [1536,1024] : kind === 'skin' ? [1254,1254] : [1024,1536];
  if (a.path !== `${kind}/${v.id}/${v.revision}/${screen}.png` || typeof a.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(a.sha256)
    || a.width !== expected[0] || a.height !== expected[1] || !Number.isSafeInteger(a.bytes)) throw Error('Invalid artwork file');
  return { path: a.path as string, sha256: a.sha256, bytes: number(a.bytes,1,5*1024*1024), width: a.width as number, height: a.height as number };
 };
 const home = file(v.home,'home'), focus = file(v.focus,'focus');
 const effects: SkinEffect[] = [];
 if (v.effects !== undefined && !Array.isArray(v.effects)) throw Error('Invalid artwork effects');
 if (Array.isArray(v.effects) && v.effects.length > 3) throw Error('Too many effects');
 for (const input of (v.effects ?? []) as unknown[]) {
  const e = object(input);
  // A future effect must not hide an otherwise supported image.
  if (e.kind !== 'warmSteam' || e.version !== undefined && e.version !== 1) continue;
  const placement = (input: unknown) => { const p = object(input); return {x:number(p.x,0,1),y:number(p.y,0,1),width:number(p.width,.01,.5),opacity:number(p.opacity,0,1)}; };
  effects.push({kind:'warmSteam',home:placement(e.home),focus:placement(e.focus)});
 }
 let homePlacement: ArtworkManifest['homePlacement'];
 if (v.homePlacement !== undefined) { const p = object(v.homePlacement); homePlacement={scale:number(p.scale,.1,2),x:number(p.x,0,1536),y:number(p.y,0,1024)}; }
 const focusBottom = v.focusBottom === undefined ? undefined : number(v.focusBottom,0,1254);
 return {schemaVersion:1,revision:v.revision as string,kind,id:v.id as string,name:v.name,home,focus,effects,
  ...(kind==='skin'?{character:v.character as CharacterId}:{}),...(homePlacement?{homePlacement}:{}),...(focusBottom===undefined?{}:{focusBottom})};
}
export function artworkUrl(base: string, file: ArtworkFile): string {
 const u = new URL(base);
 if (u.protocol !== 'https:' || !u.hostname.endsWith('.supabase.co') || u.username || u.password || u.pathname !== '/' || u.search || u.hash
  || !/^(skin|background)\/[a-z0-9][a-z0-9_-]{0,79}\/[a-f0-9-]{36}\/(home|focus)\.png$/.test(file.path)) throw Error('Untrusted artwork URL');
 return `${u.origin}/storage/v1/object/public/${ARTWORK_BUCKET}/${file.path}`;
}
