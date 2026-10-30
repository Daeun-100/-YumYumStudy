import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseInput } from '../supabase/functions/admin-toasts/core.ts';
export const endpoint = 'https://hxwwhgxxvyzqqnxlgqde.supabase.co/functions/v1/admin-toasts';
/** Production deployment artifacts are explicit inputs; never guess by tag ordering. */
export function deploymentTarget(record, easResponse, plan) {
  if (record?.status !== 'published' || record.channel !== 'production' || record.platform !== 'android'
    || plan?.mode !== 'update' || plan.sha !== record.sha || plan.runtimeVersion !== record.runtimeVersion
    || plan.baseline?.tag !== record.apkTag) throw Error('Verified successful production deployment required');
  const rows = Array.isArray(easResponse) ? easResponse : [easResponse];
  const row = rows.find(r => r.id === record.updateId && r.group === record.groupId && r.platform === 'android');
  if (!row || row.runtimeVersion !== record.runtimeVersion) throw Error('EAS response does not match deployment record');
  return { projectId: '973ad697-739b-49cc-bd6f-fbef67a1059e', updateId: record.updateId, groupId: record.groupId,
    channel: record.channel, runtimeVersion: record.runtimeVersion, sha: record.sha };
}
export function prepare(raw, now = Date.now()) {
  const v = { ...raw };
  v.requestId ??= crypto.randomUUID(); v.campaignId ??= crypto.randomUUID();
  v.userIds ??= null;
  v.startsAt ??= new Date(now).toISOString();
  v.expiresAt ??= new Date(Date.parse(v.startsAt) + (v.kind === 'update_ready' ? 7 : 1) * 86400000).toISOString();
  v.platforms ??= v.kind === 'update_ready' ? ['android'] : ['android', 'ios', 'web'];
  if (!v.appVariant) throw Error('Explicit appVariant required');
  return parseInput({ ...v, action: 'preview' }, now);
}
export async function request(input, config, fetcher = fetch) {
  if (typeof config?.token !== 'string' || config.token.length < 64) throw Error('Missing admin toast credential');
  const parsed = parseInput(input);
  const response = await fetcher(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', 'x-admin-toast-token': config.token }, body: JSON.stringify(parsed) });
  return { httpStatus: response.status, ...await response.json() };
}
async function main() {
  const [action, inputFile, ...extra] = process.argv.slice(2);
  if (!['preview', 'create', 'delete', 'list', 'status'].includes(action) || !inputFile || extra.length) throw Error('Use <action> <private JSON input file>');
  const credentialFile = path.join(os.homedir(), '.codex', 'skills', 'yumyum-send-toast', 'private', 'admin.json');
  if (fs.statSync(credentialFile).mode & 0o077) throw Error('Credentials must have mode 0600');
  const config = JSON.parse(fs.readFileSync(credentialFile, 'utf8'));
  const raw = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  let input = raw.prepared ?? raw;
  if (action === 'preview') {
    if (input.deploymentFiles) {
      const { record, easResponse, plan } = input.deploymentFiles;
      input = { ...input, payload: deploymentTarget(...[record, easResponse, plan].map(file => JSON.parse(fs.readFileSync(file, 'utf8')))) };
    }
    input = prepare(input);
  } else {
    if (!input.requestId) throw Error('Request UUID required; reuse saved preview UUID for create');
    input = { ...input, action };
  }
  console.error(JSON.stringify({ requestId: input.requestId, action }));
  const result = await request(input, config);
  console.log(JSON.stringify(result));
  if (result.httpStatus >= 400) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(() => {
  console.error('Admin toast request failed. Preserve requestId and query status before retrying. Check input and local credential configuration.'); process.exitCode = 1;
});
