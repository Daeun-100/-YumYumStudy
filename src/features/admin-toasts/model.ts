export type Campaign = {
  id: string; schema_version: number; kind: 'update_ready' | 'info_notice'; room_id: number;
  starts_at: string; expires_at: string; platforms: string[]; app_variant: string;
  min_capability_version: number; revision: number; payload: Record<string, string>;
};
export type OtaTarget = {
  enabled: boolean; pending: boolean; downloadedId: string | null; runningId: string | null;
  channel: string | null; runtime: string | null;
};
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function decodeCampaign(value: unknown): Campaign | null {
  if (!value || typeof value !== 'object') return null;
  const c = value as Campaign;
  if (!UUID.test(c.id) || c.schema_version !== 1 || !['update_ready', 'info_notice'].includes(c.kind)
    || ![0, 1].includes(c.room_id) || !Number.isInteger(c.revision) || !Number.isInteger(c.min_capability_version)
    || !Number.isFinite(Date.parse(c.starts_at)) || !Number.isFinite(Date.parse(c.expires_at))
    || !Array.isArray(c.platforms) || !c.platforms.every(p => ['android', 'ios', 'web'].includes(p))
    || !['test', 'production'].includes(c.app_variant) || !c.payload || typeof c.payload !== 'object') return null;
  if (c.kind === 'info_notice' && (typeof c.payload.title !== 'string' || !c.payload.title.trim() || c.payload.title.length > 60
    || (c.payload.message !== undefined && (typeof c.payload.message !== 'string' || c.payload.message.length > 240)))) return null;
  if (c.kind === 'update_ready' && (!UUID.test(c.payload.updateId) || !UUID.test(c.payload.groupId)
    || typeof c.payload.channel !== 'string' || typeof c.payload.runtimeVersion !== 'string')) return null;
  return c;
}
export function eligible(c: Campaign, context: { room: number; platform: string; variant: string; now: number; ota: OtaTarget }) {
  if (c.room_id !== context.room || !c.platforms.includes(context.platform) || c.app_variant !== context.variant
    || c.min_capability_version > 1 || context.now < Date.parse(c.starts_at) || context.now >= Date.parse(c.expires_at)) return false;
  if (c.kind === 'info_notice') return true;
  const o = context.ota;
  return o.enabled && o.pending && o.downloadedId === c.payload.updateId && o.runningId !== c.payload.updateId
    && o.channel === c.payload.channel && o.runtime === c.payload.runtimeVersion;
}
export function orderCampaigns(campaigns: Campaign[]) {
  return [...campaigns].sort((a, b) => Number(b.kind === 'update_ready') - Number(a.kind === 'update_ready')
    || Date.parse(a.starts_at) - Date.parse(b.starts_at) || a.id.localeCompare(b.id));
}
