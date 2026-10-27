import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { changesApp, deploymentMode, newestRelease, restoreRuntimeBaseline, validateUpdate } from '../scripts/deployment.mjs';
const runtimeVersion = 'c'.repeat(40);
const baseline = { runtimeVersion, version: '1.0.1', revision: 2 };
const input = { changed: true, runtimeVersion, baseline, version: '1.0.1', revision: 2 };
test('only a published matching APK runtime and version permits OTA', () => {
  assert.equal(deploymentMode(input), 'update');
  for (const patch of [{ baseline: null }, { baseline: { ...baseline, runtimeVersion: undefined } },
    { runtimeVersion: 'd'.repeat(40) }, { version: '1.0.2' }, { revision: 3 }]) {
    assert.equal(deploymentMode({ ...input, ...patch }), 'apk');
  }
  assert.equal(deploymentMode({ ...input, changed: false }), 'skip');
});
test('docs, server and tests do not publish; mobile and native inputs do', () => {
  assert.equal(changesApp(['docs/SPEC.md', 'supabase/migrations/change.sql', 'tests/check.mjs', '.github/workflows/check.yml']), false);
  for (const file of ['src/data/leave.ts', 'assets/icon.png', 'app.config.js', 'plugins/widget.js', 'modules/timer/android/a.kt', 'package-lock.json']) {
    assert.equal(changesApp([file]), true);
  }
});
test('draft, prerelease and non-app releases cannot replace the production APK baseline', () => {
  const stable = { tag_name: 'v1.0.2', draft: false, prerelease: false };
  assert.equal(newestRelease([stable, { ...stable, tag_name: 'v2.0.0', draft: true },
    { ...stable, tag_name: 'v1.0.3', prerelease: true }, { ...stable, tag_name: 'updates' },
    { ...stable, tag_name: 'v1.0.1' }]), stable);
  assert.equal(newestRelease([]), null);
});
test('update record must identify the exact checked Android runtime and master SHA', () => {
  const plan = { runtimeVersion, sha: 'a'.repeat(40) };
  const update = { id: '11111111-1111-4111-8111-111111111111', group: '22222222-2222-4222-8222-222222222222',
    platform: 'android', runtimeVersion, gitCommitHash: plan.sha };
  assert.equal(validateUpdate([update], plan), update);
  for (const patch of [{ platform: 'ios' }, { runtimeVersion: 'd'.repeat(40) }, { gitCommitHash: 'b'.repeat(40) }]) {
    assert.throws(() => validateUpdate([{ ...update, ...patch }], plan));
  }
  assert.throws(() => validateUpdate([], plan));
});
test('production workflows route from master and serialize with release promotion', () => {
  const cloud = readFileSync(new URL('../.github/workflows/cloud-build.yml', import.meta.url), 'utf8');
  assert.match(cloud, /branches: \[master\]/);
  assert.match(cloud, /actions: read/);
  assert.doesNotMatch(cloud, /paths: \[app.json, package.json\]/);
  assert.match(cloud, /needs.prepare.outputs.mode == 'update'/);
  assert.match(cloud, /needs.prepare.outputs.mode == 'apk'/);
  assert.match(cloud, /deployment.mjs publish/);
  const check = readFileSync(new URL('../.github/workflows/check.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(check, /node scripts\/check-release.mjs/);
  for (const file of ['publish-release.yml', 'publish-web.yml']) {
    assert.match(readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8'), /group: deploy-production/);
  }
});

test('production planner refuses local invocation and non-master Actions runs before any network access', async () => {
  const { spawnSync } = await import('node:child_process');
  const script = new URL('../scripts/deployment.mjs', import.meta.url);
  for (const env of [ { GITHUB_ACTIONS: '' }, { GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/develop' } ]) {
    const result = spawnSync(process.execPath, [script.pathname, 'plan'], { encoding: 'utf8', env: { ...process.env, ...env } });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /GitHub Actions only|requires master/);
  }
});


test('legacy published APK runtime can be recovered from the archived EAS result only when it matches the release', () => {
  const candidate = { sha: 'a'.repeat(40), version: '1.0.1', revision: 2 };
  const app = { android: { package: 'com.yumyumstudy.app' } };
  const build = { id: '11111111-1111-4111-8111-111111111111', status: 'FINISHED', platform: 'ANDROID',
    buildProfile: 'production', gitCommitHash: candidate.sha, appIdentifier: app.android.package,
    appVersion: candidate.version, appBuildVersion: '2', runtime: { version: runtimeVersion }, updateChannel: { name: 'production' } };
  assert.equal(restoreRuntimeBaseline(candidate, build, app).runtimeVersion, runtimeVersion);
  assert.equal(restoreRuntimeBaseline(candidate, { ...build, runtime: null }, app), candidate);
  assert.equal(restoreRuntimeBaseline(candidate, { ...build, updateChannel: null }, app), candidate);
  for (const patch of [{ status: 'ERRORED' }, { buildProfile: 'test' }, { gitCommitHash: 'b'.repeat(40) },
    { appIdentifier: 'another.app' }, { appVersion: '1.0.2' }, { appBuildVersion: '3' }]) {
    assert.throws(() => restoreRuntimeBaseline(candidate, { ...build, ...patch }, app));
  }
});

test('only explicit verified native compatibility permits an administrative fingerprint mismatch', () => {
  assert.equal(deploymentMode({ ...input, runtimeVersion: 'e'.repeat(40) }), 'apk');
  assert.equal(deploymentMode({ ...input, runtimeVersion: 'e'.repeat(40), nativeCompatible: true }), 'update');
  assert.equal(deploymentMode({ ...input, nativeCompatible: false }), 'apk');
});

test('web promotion requires successful OTA and the exact web candidate from this source and run', async () => {
  const { validateWebPromotion } = await import('../scripts/deployment.mjs');
  const sha = 'a'.repeat(40);
  const plan = { mode: 'update', sha, runtimeVersion };
  const update = { status: 'published', sha, runtimeVersion };
  const identifier = `production-${sha.slice(0, 12)}-45-1`;
  const web = { identifier };
  const context = { sha, deploymentId: identifier, runNumber: '45' };
  assert.equal(validateWebPromotion(plan, update, web, context), identifier);
  // The web job can be from attempt 1 while only the approved update job is retried.
  assert.equal(validateWebPromotion(plan, update, web, { ...context, runAttempt: '2' }), identifier);
  for (const patch of [{ status: 'failed' }, { sha: 'b'.repeat(40) }, { runtimeVersion: 'd'.repeat(40) }]) {
    assert.throws(() => validateWebPromotion(plan, { ...update, ...patch }, web, context));
  }
  assert.throws(() => validateWebPromotion({ ...plan, mode: 'apk' }, update, web, context));
  assert.throws(() => validateWebPromotion(plan, update, { identifier: identifier + '-other' }, context));
  assert.throws(() => validateWebPromotion(plan, update, web, { ...context, runNumber: '46' }));
  assert.throws(() => validateWebPromotion(plan, update, web, { ...context, sha: 'b'.repeat(40) }));
});

test('OTA workflow waits for web build and promotes it only after Android publication', () => {
  const cloud = readFileSync(new URL('../.github/workflows/cloud-build.yml', import.meta.url), 'utf8');
  const web = cloud.slice(cloud.indexOf('  web:'), cloud.indexOf('  record:'));
  const update = cloud.slice(cloud.indexOf('  update:'), cloud.indexOf('  history:'));
  assert.match(web, /mode == 'apk' \|\| needs.prepare.outputs.mode == 'update'/);
  assert.match(web, /steps.deploy.outputs.deployment_id/);
  assert.doesNotMatch(web, /deploy:alias|--prod\s/);
  assert.match(update, /needs: \[prepare, web\]/);
  assert.match(update, /environment: production/);
  assert.ok(update.indexOf('deployment.mjs promote-web') > update.indexOf('deployment.mjs publish'));
  assert.match(update, /WEB_DEPLOYMENT_ID: \$\{\{ needs.web.outputs.deployment_id \}\}/);
  assert.match(update, /web-promotion-record.json/);
});
