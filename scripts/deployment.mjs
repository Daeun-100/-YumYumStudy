import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCandidate } from './release-candidate.mjs';
import { baselineIdentity, nativeCompatibility, readReview, reviewPath, sourceSnapshot, verifyReviewDecision } from './deployment-review.mjs';

const json = path => JSON.parse(readFileSync(path, 'utf8'));
const run = (command, args) => execFileSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const git = args => run('git', args).trim();
const gh = args => run('gh', args);
const eas = (args, env = process.env) => execFileSync('npx', ['--yes', 'eas-cli@25.3.0', ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env });
const save = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

export function changesApp(files) {
  return files.some(file => !/^(docs\/|tests\/|supabase\/|download-site\/|\.github\/|stories\/|\.storybook\/)/.test(file)
    && !/^[^/]+\.md$/.test(file));
}
export function deploymentMode({ changed, runtimeVersion, baseline, version, revision, nativeCompatible = baseline?.runtimeVersion === runtimeVersion }) {
  if (!changed) return 'skip';
  if (!baseline?.runtimeVersion || !nativeCompatible
    || baseline.version !== version || baseline.revision !== revision) return 'apk';
  return 'update';
}
export function newestRelease(releases) {
  const stable = releases.filter(r => !r.draft && !r.prerelease && /^v\d+\.\d+\.\d+$/.test(r.tag_name));
  return stable.sort((a, b) => {
    const av = a.tag_name.slice(1).split('.').map(Number), bv = b.tag_name.slice(1).split('.').map(Number);
    for (let i = 0; i < 3; i++) if (av[i] !== bv[i]) return bv[i] - av[i];
    return 0;
  })[0] ?? null;
}
export function validateUpdate(updates, plan) {
  assert.ok(Array.isArray(updates) && updates.length === 1, 'Expected one Android update');
  const update = updates[0];
  assert.equal(update.platform, 'android');
  assert.equal(update.runtimeVersion, plan.runtimeVersion, 'Published runtime differs from the checked APK runtime');
  assert.equal(update.gitCommitHash, plan.sha, 'Published update differs from the checked master commit');
  for (const key of ['id', 'group']) assert.match(update[key], /^[a-f0-9-]{36}$/i);
  return update;
}
export function validateWebPromotion(plan, update, web, { sha, deploymentId, runNumber }) {
  assert.equal(plan.mode, 'update');
  assert.equal(plan.sha, sha, 'Web candidate must use the checked master source');
  assert.equal(update.status, 'published', 'Android OTA must succeed before web promotion');
  assert.equal(update.sha, sha, 'OTA source differs from web source');
  assert.equal(update.runtimeVersion, plan.runtimeVersion, 'OTA runtime differs from checked plan');
  assert.match(String(runNumber), /^\d+$/);
  assert.match(deploymentId, new RegExp(`^production-${sha.slice(0, 12)}-${runNumber}-[0-9]+$`));
  assert.equal(web.identifier, deploymentId, 'Web artifact differs from this run\'s verified candidate');
  return deploymentId;
}
export function restoreRuntimeBaseline(candidate, build, app) {
  assert.equal(build.status, 'FINISHED');
  assert.equal(build.platform, 'ANDROID');
  assert.equal(build.buildProfile, 'production');
  assert.equal(build.gitCommitHash, candidate.sha);
  assert.equal(build.appIdentifier, app.android.package);
  assert.equal(build.appVersion, candidate.version);
  assert.equal(String(build.appBuildVersion), String(candidate.revision));
  if (!/^[a-f0-9]{40,64}$/i.test(build.runtime?.version ?? '') || build.updateChannel?.name !== 'production') return candidate;
  assert.match(build.runtime.version, /^[a-f0-9]{40,64}$/i);
  assert.match(build.id, /^[a-f0-9-]{36}$/i);
  return { ...candidate, runtimeVersion: build.runtime.version, buildId: build.id };
}
function requireMaster() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Production deployment runs in GitHub Actions only');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/master', 'Production deployment requires master');
  assert.equal(process.env.APP_VARIANT, 'production');
  assert.equal(process.env.EXPO_PUBLIC_APP_VARIANT, 'production');
  const sha = git(['rev-parse', 'HEAD']);
  assert.equal(sha, process.env.GITHUB_SHA, 'Checkout must be the triggering commit');
  assert.equal(git(['status', '--porcelain']), '', 'Deploy only the committed master checkout');
  const latest = git(['ls-remote', 'origin', 'refs/heads/master']).split(/\s/)[0];
  assert.equal(sha, latest, 'A newer master commit exists; deploy that commit instead');
  return sha;
}
function appConfig() {
  const app = json('app.json').expo;
  assert.equal(app.version, json('package.json').version, 'App and package versions must match');
  assert.match(app.version, /^\d+\.\d+\.\d+$/);
  assert.ok(Number.isSafeInteger(app.android.versionCode) && app.android.versionCode > 0);
  return app;
}
function publishedBaseline() {
  const repository = process.env.GITHUB_REPOSITORY;
  const pages = JSON.parse(gh(['api', `repos/${repository}/releases?per_page=100`, '--paginate', '--slurp']));
  const release = newestRelease(pages.flat());
  if (!release) return null;
  // Missing/malformed candidate metadata is an error, never permission to publish OTA.
  let candidate = JSON.parse(gh(['release', 'download', release.tag_name, '--repo', repository,
    '--pattern', 'candidate.json', '--output', '-']));
  const sha = git(['rev-parse', `${release.tag_name}^{commit}`]);
  assert.equal(candidate.sha, sha, 'Published release tag moved');
  git(['merge-base', '--is-ancestor', sha, 'HEAD']);
  const app = JSON.parse(git(['show', `${sha}:app.json`])).expo;
  validateCandidate(candidate, app, release.tag_name, repository);
  const buildRun = JSON.parse(gh(['api', `repos/${repository}/actions/runs/${candidate.runId}`]));
  assert.equal(buildRun.head_branch, 'master');
  assert.equal(buildRun.head_sha, sha);
  assert.equal(buildRun.path, '.github/workflows/cloud-build.yml');
  assert.equal(buildRun.conclusion, 'success');
  // Older verified releases already archived the EAS JSON, even before runtime
  // metadata was added to candidate.json. Read just that member, never extract it.
  if (!candidate.runtimeVersion && release.assets?.some(asset => asset.name === 'build-results.tgz')) {
    const directory = mkdtempSync(join(tmpdir(), 'yumyum-published-build-'));
    try {
      gh(['release', 'download', release.tag_name, '--repo', repository, '--pattern', 'build-results.tgz', '--dir', directory]);
      const builds = JSON.parse(run('tar', ['-xOf', join(directory, 'build-results.tgz'),
        `results/android-production-${sha}/android-build.json`]));
      assert.ok(Array.isArray(builds) && builds.length === 1);
      candidate = restoreRuntimeBaseline(candidate, builds[0], app);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }
  return { ...candidate, tag: release.tag_name };
}
function currentRuntime(env = process.env) {
  // Same SDK-local resolver used by EAS; CNG ignores generated local native folders.
  const result = JSON.parse(execFileSync('node', ['node_modules/expo-updates/bin/cli.js',
    'runtimeversion:resolve', '--platform', 'android', '--workflow', 'managed'], { encoding: 'utf8', env }));
  assert.match(result.runtimeVersion, /^[a-f0-9]{40,64}$/i, 'Expected a fingerprint runtime policy');
  return result.runtimeVersion;
}
async function main() {
  const command = process.argv[2];
  if (command === 'check') { appConfig(); return; }
  if (command === 'review-context' || command === 'review-check') {
    const dirty = git(['diff', '--name-only', 'HEAD', '--', '.', `:(exclude)${reviewPath}`]).trim();
    const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(file => file && file !== reviewPath);
    assert.ok(!dirty && untracked.length === 0, 'Commit the intended source changes before generating or verifying a review');
    const base = process.env.REVIEW_BASE || 'origin/master';
    const files = git(['diff', '--name-only', base, 'HEAD']).split('\n').filter(Boolean);
    const changed = changesApp(files);
    if (command === 'review-check' && !changed && !files.includes(reviewPath)) {
      console.log('No deployment review required for non-app changes'); return;
    }
    const baseline = publishedBaseline();
    const app = appConfig();
    const native = await nativeCompatibility(process.cwd(), baseline);
    const mode = deploymentMode({ changed, baseline, version: app.version, revision: app.android.versionCode, nativeCompatible: native.compatible });
    const snapshot = sourceSnapshot();
    if (command === 'review-check') {
      verifyReviewDecision(readReview(), { digest: snapshot.sourceTreeDigest, baseline, mode, exemptions: native.exemptions });
      console.log(`Deployment review and native compatibility verified: ${mode}`);
    } else console.log(JSON.stringify({ ...snapshot, baseline: baselineIdentity(baseline), mode, native, files }, null, 2));
    return;
  }
  if (command === 'plan') {
    const sha = requireMaster();
    const app = appConfig();
    const event = json(process.env.GITHUB_EVENT_PATH);
    const before = event.before;
    const files = before && !/^0+$/.test(before) ? git(['diff', '--name-only', before, sha]).split('\n').filter(Boolean) : ['src/'];
    const changed = changesApp(files);
    const needsReview = changed || files.includes(reviewPath);
    let plan;
    try {
      if (existsSync(reviewPath)) {
        try { save('deployment-review.json', json(reviewPath)); }
        catch { save('deployment-review.json', { invalid: true, error: 'Review is not valid JSON' }); }
      }
      const baseline = needsReview ? publishedBaseline() : null;
      const observedRuntimeVersion = changed ? currentRuntime() : null;
      const native = needsReview ? await nativeCompatibility(process.cwd(), baseline) : { compatible: true, exemptions: [], reasons: [] };
      save('native-compatibility.json', native);
      const mode = deploymentMode({ changed, baseline, version: app.version, revision: app.android.versionCode, nativeCompatible: native.compatible });
      const review = needsReview ? readReview() : null;
      if (needsReview) verifyReviewDecision(review, { digest: sourceSnapshot().sourceTreeDigest, baseline, mode, exemptions: native.exemptions });
      save('deployment-review-validation.json', { status: needsReview ? 'verified' : 'not-required', mode, sha,
        sourceTreeDigest: sourceSnapshot().sourceTreeDigest, baseline: baselineIdentity(baseline) });
      plan = { schema: 1, mode, sha, observedRuntimeVersion,
        runtimeVersion: mode === 'update' ? baseline.runtimeVersion : observedRuntimeVersion,
        baseline, native, review, version: app.version, revision: app.android.versionCode,
        repository: process.env.GITHUB_REPOSITORY,
        run: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` };
      save('deployment-plan.json', plan);
    } catch (error) {
      save('deployment-review-validation.json', { status: 'rejected', sha, error: error.message });
      throw error;
    }
    const { mode, baseline } = plan;
    appendFileSync(process.env.GITHUB_OUTPUT, `mode=${mode}\n`);
    console.log(`Production deployment: ${mode}; commit ${sha}; published APK ${baseline?.tag ?? 'none'}`);
  } else if (command === 'promote-web') {
    const sha = requireMaster();
    const plan = json('deployment-plan.json');
    const baseline = publishedBaseline();
    const native = await nativeCompatibility(process.cwd(), baseline);
    assert.ok(native.compatible, 'Native compatibility changed before web promotion');
    verifyReviewDecision(readReview(), { digest: sourceSnapshot().sourceTreeDigest, baseline, mode: 'update', exemptions: native.exemptions });
    assert.equal(plan.runtimeVersion, baseline.runtimeVersion);
    const deploymentId = validateWebPromotion(plan, json('update-record.json'), json('results/web-ota/web-deployment.json'), {
      sha, deploymentId: process.env.WEB_DEPLOYMENT_ID, runNumber: process.env.GITHUB_RUN_NUMBER,
    });
    eas(['deploy:alias', '--id', deploymentId, '--prod', '--non-interactive']);
    mkdirSync('publication', { recursive: true });
    save('publication/web-promotion-record.json', { schema: 1, status: 'published', sha, deploymentId,
      run: plan.run, createdAt: new Date().toISOString() });
  } else if (command === 'publish') {
    const plan = json('deployment-plan.json');
    assert.equal(plan.mode, 'update');
    assert.equal(requireMaster(), plan.sha);
    const baseline = publishedBaseline();
    assert.equal(baseline?.sha, plan.baseline?.sha, 'Published APK changed since planning');
    assert.equal(baseline?.runtimeVersion, plan.runtimeVersion);
    assert.equal(currentRuntime(), plan.observedRuntimeVersion, 'Runtime changed after planning');
    const native = await nativeCompatibility(process.cwd(), baseline);
    assert.ok(native.compatible, 'Native compatibility changed after planning');
    const review = readReview();
    assert.deepEqual(review, plan.review, 'Review changed after planning');
    verifyReviewDecision(review, { digest: sourceSnapshot().sourceTreeDigest, baseline, mode: 'update', exemptions: native.exemptions });
    const otaEnv = { ...process.env, YUMYUM_OTA_RUNTIME: plan.runtimeVersion, YUMYUM_OTA_SOURCE: plan.sha };
    assert.equal(currentRuntime(otaEnv), plan.runtimeVersion, 'OTA target runtime is not the installed APK runtime');
    const project = eas(['project:info']);
    const projectName = project.match(/fullName\s+@([^/\s]+)\/([^\s]+)/);
    assert.ok(projectName, 'Could not resolve the EAS project dashboard');
    const subject = git(['log', '-1', '--format=%s']).slice(0, 180);
    const message = `master ${plan.sha.slice(0, 12)}: ${subject}`;
    const raw = eas(['update', '--channel', 'production', '--environment', 'production', '--platform', 'android',
      '--message', message, '--non-interactive', '--json'], otaEnv);
    writeFileSync('eas-update.json', raw);
    const update = validateUpdate(JSON.parse(raw), plan);
    const url = `https://expo.dev/accounts/${encodeURIComponent(projectName[1])}/projects/${encodeURIComponent(projectName[2])}/updates/${update.group}`;
    save('update-record.json', { schema: 1, status: 'published', channel: 'production', platform: 'android',
      sha: plan.sha, runtimeVersion: plan.runtimeVersion, apkTag: baseline.tag, message,
      updateId: update.id, groupId: update.group, createdAt: update.createdAt, url, run: plan.run });
  } else if (command === 'summary') {
    if (!process.env.GITHUB_STEP_SUMMARY) return;
    const plan = existsSync('deployment-plan.json') ? json('deployment-plan.json') : null;
    const record = existsSync('update-record.json') ? json('update-record.json') : null;
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
      '## Production deployment', '',
      `- Commit: ${plan?.sha ?? process.env.GITHUB_SHA}`,
      `- Route: ${plan?.mode ?? 'planning failed'}`,
      `- Runtime: ${plan?.runtimeVersion ?? 'n/a'}`,
      `- Published APK: ${plan?.baseline?.tag ?? 'none / not inspected'}`,
      `- Result: ${record ? 'EAS Update published' : process.env.DEPLOY_JOB_STATUS ?? 'not published'}`,
      ...(record ? [`- Update: [${record.groupId}](${record.url})`, `- Published at: ${record.createdAt}`] : []), '',
    ].join('\n'));
  } else throw new Error('Expected check, plan, publish or summary');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
