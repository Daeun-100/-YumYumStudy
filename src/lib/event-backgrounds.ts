import { decodeArtwork, type ArtworkManifest } from './artwork-content.ts';
export type EventBackgroundWindow = { artwork?: ArtworkManifest; id: string; startsAt: string; endsAt: string; screens: ('home' | 'focus')[]; homeAsset: string; focusAsset: string };
export type EventBackgroundSnapshot = { serverNow: string; roomId: number; windows: EventBackgroundWindow[] };
export function decodeEventBackgrounds(value: unknown): EventBackgroundSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Invalid background response');
  const row = value as Record<string, unknown>;
  const validDate = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
  if (!validDate(row.serverNow) || ![0, 1].includes(row.roomId as number) || !Array.isArray(row.windows)) throw new Error('Invalid background response');
  const windows = row.windows.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid background window');
    const w = item as Record<string, unknown>;
    if (typeof w.id !== 'string' || !validDate(w.startsAt) || !validDate(w.endsAt) || Date.parse(w.startsAt) >= Date.parse(w.endsAt)
      || !Array.isArray(w.screens) || !w.screens.length || !w.screens.every(s => s === 'home' || s === 'focus')
      || typeof w.homeAsset !== 'string' || typeof w.focusAsset !== 'string') throw new Error('Invalid background window');
    let artwork: ArtworkManifest | undefined;
    try { if (w.artwork) { const candidate=decodeArtwork(w.artwork); if(candidate.kind==='background')artwork=candidate; } } catch { /* Old/local fallback remains valid. */ }
    return { ...w, ...(artwork?{artwork,homeAsset:`remote:${artwork.revision}:home`,focusAsset:`remote:${artwork.revision}:focus`}:{}) } as EventBackgroundWindow;
  });
  return { serverNow: row.serverNow, roomId: row.roomId as number, windows };
}
export function selectEventBackgrounds(windows: EventBackgroundWindow[], now: number) {
  const current = windows.filter(w => Date.parse(w.startsAt) <= now && now < Date.parse(w.endsAt));
  return {
    home: current.find(w => w.screens.includes('home'))?.homeAsset,
    focus: current.find(w => w.screens.includes('focus'))?.focusAsset,
  };
}
