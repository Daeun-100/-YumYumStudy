const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const project = '973ad697-739b-49cc-bd6f-fbef67a1059e';
export type Input = Record<string, unknown> & { action: string; requestId: string; campaignId?: string; roomId?: number };
export function parseInput(raw: unknown, now = Date.now()): Input {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Invalid input');
  const v = raw as Record<string, unknown>;
  const actions = ['preview', 'create', 'delete', 'list', 'status'];
  if (!actions.includes(String(v.action)) || typeof v.requestId !== 'string' || !uuid.test(v.requestId)) throw Error('Action and request UUID required');
  if (v.enabled !== undefined || v.sourceCampaignId !== undefined) throw Error('Enable/disable and resend are unsupported; create or delete a notice');
  const result: Input = { action: String(v.action), requestId: v.requestId.toLowerCase() };
  if (v.campaignId !== undefined) {
    if (typeof v.campaignId !== 'string' || !uuid.test(v.campaignId)) throw Error('Invalid campaign UUID');
    result.campaignId = v.campaignId.toLowerCase();
  }
  if (v.action === 'status') return result;
  if (v.action === 'delete') {
    if (!result.campaignId || !Number.isSafeInteger(v.expectedRevision) || Number(v.expectedRevision) < 1) throw Error('Campaign and revision required');
    return { ...result, expectedRevision: v.expectedRevision };
  }
  if (![0, 1].includes(Number(v.roomId)) || typeof v.roomId !== 'number') throw Error('Room required');
  result.roomId = v.roomId;
  if (v.action === 'list') return result;
  if (!result.campaignId || !['info_notice', 'update_ready'].includes(String(v.kind))) throw Error('Campaign and kind required');
  const ids = v.userIds;
  if (ids !== null && (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(id => typeof id !== 'string' || !uuid.test(id)))) throw Error('userIds must be null or 1-100 UUIDs');
  result.userIds = ids === null ? null : [...new Set((ids as string[]).map(id => id.toLowerCase()))].sort();
  const variant = v.appVariant;
  if (!['test', 'production'].includes(String(variant)) || (variant === 'production' && v.roomId !== 1)) throw Error('Invalid variant');
  const platforms = v.platforms;
  if (!Array.isArray(platforms) || !platforms.length || platforms.some(p => !['android', 'ios', 'web'].includes(p))) throw Error('Invalid platforms');
  const starts = Date.parse(String(v.startsAt)), expires = Date.parse(String(v.expiresAt));
  if (!Number.isFinite(starts) || !Number.isFinite(expires) || expires <= starts || expires - starts > 30 * 86400000) throw Error('Explicit valid period required (maximum 30 days)');
  if (expires <= now && v.action === 'preview') throw Error('Already expired');
  const p = v.payload as Record<string, unknown>;
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw Error('Payload required');
  let payload: Record<string, unknown>;
  if (v.kind === 'update_ready') {
    const keys = ['projectId', 'updateId', 'groupId', 'channel', 'runtimeVersion', 'sha'];
    if (Object.keys(p).some(k => !keys.includes(k)) || p.projectId !== project || typeof p.updateId !== 'string' || !uuid.test(p.updateId)
      || typeof p.groupId !== 'string' || !uuid.test(p.groupId) || !['production', 'test'].includes(String(p.channel))
      || p.channel !== variant || typeof p.runtimeVersion !== 'string' || !p.runtimeVersion.trim() || p.runtimeVersion.length > 150
      || typeof p.sha !== 'string' || !/^[a-f0-9]{40}$/.test(p.sha) || platforms.length !== 1 || platforms[0] !== 'android') throw Error('Invalid verified Android deployment');
    payload = { ...p, updateId: p.updateId.toLowerCase(), groupId: p.groupId.toLowerCase() };
  } else {
    if (Object.keys(p).some(k => !['title', 'message'].includes(k)) || typeof p.title !== 'string' || !p.title.trim() || p.title.trim().length > 60
      || (p.message !== undefined && (typeof p.message !== 'string' || p.message.length > 240))) throw Error('Invalid notice text');
    payload = { title: p.title.trim(), ...(p.message ? { message: String(p.message).trim() } : {}) };
  }
  return { ...result, kind: v.kind, appVariant: variant, platforms: [...new Set(platforms)].sort(),
    startsAt: new Date(starts).toISOString(), expiresAt: new Date(expires).toISOString(), payload };
}
