import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function validateCandidate(candidate, app, tag, repository) {
  assert.equal(candidate.schema, 1);
  if (candidate.runtimeVersion !== undefined) {
    assert.match(candidate.runtimeVersion, /^[a-f0-9]{40,64}$/i);
    assert.match(candidate.buildId, /^[a-f0-9-]{36}$/i);
  }
  assert.match(candidate.sha, /^[a-f0-9]{40}$/);
  assert.equal(candidate.version, app.version);
  assert.equal(candidate.revision, app.android.versionCode);
  assert.ok(Number.isSafeInteger(candidate.revision) && candidate.revision > 0);
  assert.equal(tag, `v${candidate.version}`);
  assert.match(tag, /^v\d+\.\d+\.\d+$/);
  assert.ok(Number.isSafeInteger(candidate.runId) && candidate.runId > 0);
  assert.equal(candidate.repository, repository);
  assert.match(candidate.apkSha256, /^[a-f0-9]{64}$/);
  assert.equal(candidate.apkName, `yumyumstudy-${tag}.apk`);
  assert.match(candidate.deploymentId, new RegExp(`^production-${candidate.sha.slice(0, 12)}-[0-9]+-[0-9]+$`));
  return candidate;
}

export function candidateFromBuilds({ android, web, records, app, sha, repository, runId, apk }) {
  assert.match(sha, /^[a-f0-9]{40}$/);
  for (const record of records) {
    assert.equal(record.variant, 'production');
    assert.equal(record.commit, sha);
    assert.equal(record.version, app.version);
    assert.equal(record.revision, app.android.versionCode);
    assert.equal(record.run, `https://github.com/${repository}/actions/runs/${runId}`);
  }
  assert.equal(records.length, 2);
  const builds = Array.isArray(android) ? android : [android];
  assert.equal(builds.length, 1);
  const build = builds[0];
  assert.equal(build.status, 'FINISHED');
  assert.equal(build.platform, 'ANDROID');
  assert.equal(build.buildProfile, 'production');
  assert.equal(build.appIdentifier, app.android.package);
  assert.equal(build.gitCommitHash, sha);
  assert.equal(build.appVersion, app.version);
  assert.equal(String(build.appBuildVersion), String(app.android.versionCode));
  assert.equal(build.updateChannel?.name, 'production', 'APK must receive production updates');
  assert.match(build.runtime?.version, /^[a-f0-9]{40,64}$/i, 'APK must have a fingerprint runtime');
  assert.match(build.id, /^[a-f0-9-]{36}$/i);
  const tag = `v${app.version}`;
  return validateCandidate({ schema: 1, repository, runId: Number(runId), sha,
    version: app.version, revision: app.android.versionCode,
    runtimeVersion: build.runtime.version, buildId: build.id,
    deploymentId: web.identifier, apkName: `yumyumstudy-${tag}.apk`,
    apkSha256: createHash('sha256').update(apk).digest('hex'),
  }, app, tag, repository);
}

const json = path => JSON.parse(readFileSync(path, 'utf8'));
const gh = args => execFileSync('gh', args, { encoding: 'utf8' });

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  if (process.argv[2] === 'create') {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const app = json('app.json').expo;
    const androidDir = `results/android-production-${sha}`;
    const webDir = `results/web-production-${sha}`;
    const android = json(`${androidDir}/android-build.json`);
    const build = Array.isArray(android) ? android[0] : android;
    const url = new URL(build.artifacts?.buildUrl);
    assert.equal(url.protocol, 'https:');
    assert.ok(['expo.dev', 'eas.build'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)), 'Unexpected APK artifact host');
    const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
    assert.ok(response.ok, 'Could not download the built APK');
    const apk = Buffer.from(await response.arrayBuffer());
    assert.ok(apk.length > 4 && apk.readUInt32LE(0) === 0x04034b50, 'APK is not a ZIP archive');
    const candidate = candidateFromBuilds({ android, web: json(`${webDir}/web-deployment.json`),
      records: [json(`${androidDir}/build-record.json`), json(`${webDir}/build-record.json`)],
      app, sha, repository, runId: process.env.GITHUB_RUN_ID, apk });
    writeFileSync(candidate.apkName, apk);
    writeFileSync('candidate.json', `${JSON.stringify(candidate, null, 2)}\n`);
  } else if (process.argv[2] === 'verify') {
    const event = json(process.env.GITHUB_EVENT_PATH);
    const release = event.release;
    assert.ok(release && !release.draft && !release.prerelease, 'Only a published stable release can be promoted');
    const tag = release.tag_name;
    assert.match(tag, /^v\d+\.\d+\.\d+$/);
    gh(['release', 'download', tag, '--repo', repository, '--pattern', 'candidate.json', '--dir', 'publication']);
    const candidate = json('publication/candidate.json');
    const sha = execFileSync('git', ['rev-parse', `${tag}^{commit}`], { encoding: 'utf8' }).trim();
    assert.equal(candidate.sha, sha, 'Tag moved after building');
    execFileSync('git', ['merge-base', '--is-ancestor', sha, 'origin/master']);
    const app = JSON.parse(execFileSync('git', ['show', `${sha}:app.json`], { encoding: 'utf8' })).expo;
    validateCandidate(candidate, app, tag, repository);
    const run = JSON.parse(gh(['api', `repos/${repository}/actions/runs/${candidate.runId}`]));
    assert.equal(run.head_sha, sha);
    assert.equal(run.head_branch, 'master');
    assert.equal(run.path, '.github/workflows/cloud-build.yml');
    assert.equal(run.conclusion, 'success');
    const assets = JSON.parse(gh(['api', `repos/${repository}/releases/${release.id}/assets`, '--paginate']));
    const asset = assets.find(item => item.name === candidate.apkName);
    assert.ok(asset, 'Release APK asset missing');
    const expectedUrl = `https://github.com/${repository}/releases/download/${tag}/${candidate.apkName}`;
    assert.equal(asset.browser_download_url, expectedUrl);
    gh(['release', 'download', tag, '--repo', repository, '--pattern', candidate.apkName, '--dir', 'publication']);
    assert.equal(createHash('sha256').update(readFileSync(`publication/${candidate.apkName}`)).digest('hex'), candidate.apkSha256, 'Release APK differs from the verified build');
    writeFileSync('publication/verified.json', JSON.stringify({ ...candidate, downloadUrl: expectedUrl, notes: String(release.body ?? '').slice(0, 6000) }));
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `deployment_id=${candidate.deploymentId}\n`);
  } else throw new Error('Expected create or verify');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
