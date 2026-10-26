import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function releaseRows(candidate, domain) {
  assert.match(domain, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const base = { revision: candidate.revision, version: candidate.version, notes: candidate.notes, enabled: true };
  return [
    { ...base, platform: 'android', download_url: candidate.downloadUrl },
    { ...base, platform: 'web', download_url: `https://${domain}.expo.app` },
  ];
}

export function preventRollback(current, next) {
  assert.ok(Array.isArray(current));
  for (const row of current) {
    const incoming = next.find(item => item.platform === row.platform);
    assert.ok(incoming && row.revision <= incoming.revision, 'A newer version has already been published');
    if (row.enabled && row.revision === incoming.revision) {
      assert.equal(row.version, incoming.version, 'Cannot reuse a published build number');
      assert.equal(row.download_url, incoming.download_url, 'Cannot replace a published APK with another URL');
    }
  }
}

async function main() {
  const candidate = JSON.parse(readFileSync('publication/verified.json', 'utf8'));
  const secret = process.env.SUPABASE_RELEASE_SECRET_KEY;
  assert.ok(secret, 'Add SUPABASE_RELEASE_SECRET_KEY to the GitHub production environment secrets');
  if (!secret.startsWith('sb_secret_')) {
    let role;
    try { role = JSON.parse(Buffer.from(secret.split('.')[1], 'base64url').toString()).role; } catch { /* Invalid key is rejected below. */ }
    assert.equal(role, 'service_role', 'Use a server secret key or legacy service_role key, not a public key');
  }
  const url = new URL('/rest/v1/app_releases', process.env.EXPO_PUBLIC_SUPABASE_URL);
  assert.equal(url.protocol, 'https:');
  const headers = { apikey: secret, 'Content-Type': 'application/json' };
  // New sb_secret keys belong in apikey; legacy service_role JWTs also use Bearer.
  if (!secret.startsWith('sb_secret_')) headers.Authorization = `Bearer ${secret}`;
  const next = releaseRows(candidate, process.env.EAS_HOSTING_DOMAIN);
  const checkUrl = new URL(url);
  checkUrl.searchParams.set('select', 'platform,revision,version,download_url,enabled');
  const current = await fetch(checkUrl, { headers, signal: AbortSignal.timeout(15000) });
  assert.ok(current.ok, `Release metadata preflight failed (HTTP ${current.status})`);
  preventRollback(await current.json(), next);
  if (process.argv[2] === 'preflight') {
    console.log('Release registration credentials and version order verified.');
    return;
  }
  assert.equal(process.argv[2], 'publish');
  url.searchParams.set('on_conflict', 'platform');
  const result = await fetch(url, { method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(next), signal: AbortSignal.timeout(15000) });
  assert.ok(result.ok, `Release registration failed (HTTP ${result.status}); web may already be public. Rerun this job to retry registration.`);
  console.log(`Update notices enabled for Android and web: ${candidate.version} / ${candidate.revision}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
