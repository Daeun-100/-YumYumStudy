import { artworkId, artworkRevision, type ArtworkFile } from '../../lib/artwork-content.ts';
import { postitColors } from './model.ts';
export type PostitArtwork = {
  schemaVersion: 1; kind: 'postit'; id: string; revision: string; name: string;
  paper: ArtworkFile; fallbackColor: string; textColor: string;
};
export type OwnedPostitDesign = { grantId: string; grantedAt: string; artwork: PostitArtwork };
export function decodePostitArtwork(value: unknown): PostitArtwork {
  if (!value || typeof value !== 'object') throw Error('Invalid postit artwork');
  const m = value as PostitArtwork;
  if (m.schemaVersion !== 1 || m.kind !== 'postit' || typeof m.id !== 'string' || !artworkId.test(m.id)
    || typeof m.revision !== 'string' || !artworkRevision.test(m.revision) || typeof m.name !== 'string' || !m.name.trim() || m.name.length > 60
    || !postitColors.includes(m.fallbackColor as typeof postitColors[number]) || !/^#[a-f0-9]{6}$/i.test(m.textColor)) throw Error('Unsupported postit artwork');
  const a = m.paper;
  if (!a || a.path !== `postit/${m.id}/${m.revision}/paper.png` || typeof a.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(a.sha256)
    || a.width !== 1024 || a.height !== 1024 || !Number.isSafeInteger(a.bytes) || a.bytes < 1 || a.bytes > 2 * 1024 * 1024) throw Error('Invalid postit image');
  return { schemaVersion: 1, kind: 'postit', id: m.id, revision: m.revision, name: m.name, fallbackColor: m.fallbackColor, textColor: m.textColor, paper: { ...a } };
}
export function decodeOwnedDesigns(value: unknown): OwnedPostitDesign[] {
  if (!Array.isArray(value)) throw Error('Invalid owned designs');
  return value.flatMap(row => {
    try {
      if (typeof row.grantId !== 'string' || !artworkRevision.test(row.grantId) || typeof row.grantedAt !== 'string' || !Number.isFinite(Date.parse(row.grantedAt))) return [];
      return [{ grantId: row.grantId, grantedAt: row.grantedAt, artwork: decodePostitArtwork(row.artwork) }];
    } catch { return []; }
  });
}
export function decodeVisibleDesigns(value: unknown): PostitArtwork[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(row => { try { return [decodePostitArtwork(row)]; } catch { return []; } });
}
