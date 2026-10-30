export const postitColors = ['#F9E8A0', '#F7CED4', '#DAE8BE'] as const;
export type Postit = { id: string; room_id: number; author: string; text: string; color: string; x: number; y: number; study_date: string; deleted_at: string | null; design_id?: string | null; design_revision?: string | null };
export function decodePostit(value: unknown): Postit {
  if (!value || typeof value !== 'object') throw new Error('포스트잇 정보를 확인할 수 없어요.');
  const n = value as Record<string, unknown>;
  if (typeof n.id !== 'string' || typeof n.author !== 'string' || typeof n.text !== 'string' || typeof n.color !== 'string' || !postitColors.includes(n.color as typeof postitColors[number]) || typeof n.x !== 'number' || !Number.isFinite(n.x) || n.x < 0 || n.x > 1 || typeof n.y !== 'number' || !Number.isFinite(n.y) || n.y < 0 || n.y > 1 || typeof n.room_id !== 'number' || typeof n.study_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(n.study_date) || (n.deleted_at !== null && typeof n.deleted_at !== 'string')) throw new Error('포스트잇 정보를 확인할 수 없어요.');
  return n as Postit;
}
// A late create event cannot resurrect a note already deleted in this connection.
export function mergePostit(notes: Postit[], note: Postit): Postit[] {
  const previous = notes.find(n => n.id === note.id);
  if (previous?.deleted_at && !note.deleted_at) return notes;
  return [...notes.filter(n => n.id !== note.id), note];
}
