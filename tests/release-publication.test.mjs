import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateFromBuilds, validateCandidate } from '../scripts/release-candidate.mjs';
import { preventRollback, releaseRows } from '../scripts/publish-release-info.mjs';
const sha = 'a'.repeat(40);
const app = { version: '1.0.1', android: { versionCode: 2, package: 'com.yumyumstudy.app' } };
function fixture() {
  return { app, sha, repository: 'owner/repo', runId: '12', apk: Buffer.from('apk'),
    android: [{ status: 'FINISHED', platform: 'ANDROID', buildProfile: 'production', appIdentifier: app.android.package,
      gitCommitHash: sha, appVersion: app.version, appBuildVersion: '2' }],
    web: { identifier: `production-${sha.slice(0, 12)}-8-1` },
    records: Array.from({ length: 2 }, () => ({ variant: 'production', commit: sha, version: app.version,
      revision: 2, run: 'https://github.com/owner/repo/actions/runs/12' })) };
}
test('completed matching builds produce a candidate bound to tag, SHA and APK digest', () => {
  const candidate = candidateFromBuilds(fixture());
  assert.equal(candidate.apkName, 'yumyumstudy-v1.0.1.apk');
  assert.equal(validateCandidate(candidate, app, 'v1.0.1', 'owner/repo'), candidate);
  assert.throws(() => validateCandidate(candidate, app, 'v1.0.2', 'owner/repo'));
  assert.throws(() => validateCandidate(candidate, app, 'v1.0.1', 'another/repo'));
});
test('reject test, failed, mismatched-code and mismatched-version APKs', () => {
  for (const patch of [{ buildProfile: 'test' }, { status: 'ERRORED' }, { gitCommitHash: 'b'.repeat(40) },
    { appBuildVersion: '1' }, { appIdentifier: 'com.yumyumstudy.app.test' }]) {
    const input = fixture(); Object.assign(input.android[0], patch);
    assert.throws(() => candidateFromBuilds(input));
  }
});
test('reject test web and artifact records from another build', () => {
  const input = fixture(); input.web.identifier = `test-${sha.slice(0, 12)}-8-1`;
  assert.throws(() => candidateFromBuilds(input));
  input.web.identifier = `production-${sha.slice(0, 12)}-8-1`;
  input.records[1].run = 'https://github.com/owner/repo/actions/runs/13';
  assert.throws(() => candidateFromBuilds(input));
});
test('publish stable APK URL and fixed web URL as enabled platform rows', () => {
  const rows = releaseRows({ revision: 2, version: '1.0.1', notes: 'Fix', downloadUrl: 'https://github.com/owner/repo/releases/download/v1.0.1/app.apk' }, 'yumyumstudy-daeun100');
  assert.equal(rows[0].enabled, true);
  assert.equal(rows[1].download_url, 'https://yumyumstudy-daeun100.expo.app');
  assert.throws(() => releaseRows({}, 'bad/domain'));
  preventRollback([{ ...rows[0], revision: 1 }], rows);
  preventRollback(rows, rows); // Re-running after a partial failure is safe.
  assert.throws(() => preventRollback([{ ...rows[0], revision: 3 }], rows));
  assert.throws(() => preventRollback([{ ...rows[0], download_url: 'https://different.test/app.apk' }], rows));
});
