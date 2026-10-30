import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareNativeFingerprints, baselineIdentity, inspectAdministrativeChanges, nativeInputReasons, normalizationHook, safeIgnoreAdditions, sourceSnapshot, treeDigest,
  validateReview, verifyReviewDecision } from '../scripts/deployment-review.mjs';
const digest = 'd'.repeat(64);
const baseline = { sha: 'a'.repeat(40), tag: 'v1.0.1', runtimeVersion: 'c'.repeat(40) };
const report = () => ({ schema: 1, sourceCommit: 'b'.repeat(40), sourceTreeDigest: digest, baseline: baselineIdentity(baseline),
  reviewer: { kind: 'interactive-codex' }, recommendation: 'update', releaseNotes: ['보유한 캐릭터 스킨을 프로필에서 적용하고 해제할 수 있습니다.'], rationale: 'JS changes, native runtime verified',
  evidence: ['Native fingerprint matches published APK after verified administrative normalization'], exemptions: [], blockers: [] });
test('review is bound to exact source content, published APK and deterministic route', () => {
  const r = report();
  assert.equal(verifyReviewDecision(r, { digest, baseline, mode: 'update', exemptions: [] }), r);
  for (const patch of [{ sourceTreeDigest: 'e'.repeat(64) }, { schema: 2 }, { reviewer: { kind: 'ci-ai' } },
    { recommendation: 'force-update' }, { releaseNotes: undefined }, { releaseNotes: [] }, { releaseNotes: [' '] }, { releaseNotes: ['x'.repeat(6001)] }, { evidence: [] }, { exemptions: ['ignore:package.json'] }, { baseline: {} }]) {
    assert.throws(() => validateReview({ ...r, ...patch }, digest));
  }
  for (const options of [{ baseline: { ...baseline, sha: 'f'.repeat(40) } }, { mode: 'apk' }, { exemptions: ['ignore-additions:.gitignore'] }]) {
    assert.throws(() => verifyReviewDecision(r, { digest, baseline, mode: 'update', exemptions: [], ...options }));
  }
  assert.throws(() => verifyReviewDecision({ ...r, blockers: ['Cannot verify native compatibility'] }, { digest, baseline, mode: 'update', exemptions: [] }));
});
test('only additive known deployment output exclusions are safe', () => {
  assert.equal(safeIgnoreAdditions('node_modules/\nandroid/\n', 'node_modules/\nandroid/\n# CI\ndeployment-review.json\n'), true);
  for (const next of ['node_modules/\n', 'node_modules/\nandroid/\nplugins/\n', 'node_modules/\nandroid/\n!android/\n']) {
    assert.equal(safeIgnoreAdditions('node_modules/\nandroid/\n', next), false);
  }
});
const files = pkg => ({ 'package.json': JSON.stringify(pkg), '.gitignore': 'node_modules/\n', '.easignore': 'node_modules/\n' });
test('script normalization never hides dependencies, install hooks or shortcut callers', () => {
  const pkg = { dependencies: { expo: '58' }, scripts: { 'update:production': 'old', postinstall: 'node native.js', test: 'node test' } };
  const before = files(pkg), after = files({ ...pkg, scripts: { ...pkg.scripts, 'update:production': 'new' } });
  const result = inspectAdministrativeChanges(before, after);
  assert.deepEqual(result.exemptions, ['package-script:update:production']);
  assert.deepEqual(result.reasons, []);
  for (const changed of [{ ...pkg, dependencies: { expo: '59' } }, { ...pkg, scripts: { ...pkg.scripts, postinstall: 'new native hook' } },
    { ...pkg, scripts: { ...pkg.scripts, 'update:production': 'new', postinstall: 'npm run update:production' } }]) {
    assert.ok(inspectAdministrativeChanges(before, files(changed)).reasons.length > 0);
  }
  const hook = normalizationHook(before, pkg.scripts);
  assert.equal(hook({ type: 'file', filePath: '.gitignore' }, 'new', false), null);
  assert.equal(hook({ type: 'file', filePath: '.gitignore' }, null, true), before['.gitignore']);
  assert.equal(hook({ type: 'contents', id: 'packageJson:scripts' }, JSON.stringify({ ...pkg.scripts, 'update:production': 'new' }), true), JSON.stringify(pkg.scripts));
  assert.equal(hook({ type: 'contents', id: 'expoConfig' }, 'native-input', true), 'native-input');
});
test('tree digest is identical for Git and GitHub API trees and includes modes and unrelated changes', () => {
  const entries = [{ path: 'src/app.ts', mode: '100644', type: 'blob', object: 'a'.repeat(40) }];
  const api = [{ path: 'src', mode: '040000', type: 'tree', sha: 'b'.repeat(40) },
    { path: 'src/app.ts', mode: '100644', type: 'blob', sha: 'a'.repeat(40) },
    { path: '.github/deployment-review.json', mode: '100644', type: 'blob', sha: 'c'.repeat(40) }];
  assert.equal(treeDigest(entries), treeDigest(api));
  assert.notEqual(treeDigest(entries), treeDigest([{ ...entries[0], mode: '100755' }]));
  assert.notEqual(treeDigest(entries), treeDigest([...entries, { path: 'docs/change.md', mode: '100644', type: 'blob', object: 'f'.repeat(40) }]));
});
test('report-only commit preserves reviewed digest; a later source edit invalidates it', () => {
  const directory = mkdtempSync(join(tmpdir(), 'yumyum-review-tree-'));
  const git = args => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    git(['init']); git(['config', 'user.name', 'Test']); git(['config', 'user.email', 'test@example.invalid']);
    writeFileSync(join(directory, 'app.ts'), 'original'); git(['add', '.']); git(['commit', '-m', 'source']);
    const first = sourceSnapshot(directory);
    const { mkdirSync } = process.getBuiltinModule('node:fs'); mkdirSync(join(directory, '.github'));
    writeFileSync(join(directory, '.github/deployment-review.json'), '{}'); git(['add', '.']); git(['commit', '-m', 'review']);
    assert.equal(sourceSnapshot(directory).sourceTreeDigest, first.sourceTreeDigest);
    writeFileSync(join(directory, 'app.ts'), 'changed'); git(['add', '.']); git(['commit', '-m', 'source changed']);
    assert.notEqual(sourceSnapshot(directory).sourceTreeDigest, first.sourceTreeDigest);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});


test('the committed review is not hidden by generated-record ignore patterns', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync('git', ['check-ignore', '--no-index', '.github/deployment-review.json'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8',
  });
  assert.equal(result.status, 1, 'The release review must be trackable without git add --force');
  assert.equal(safeIgnoreAdditions('node_modules/\n', 'node_modules/\n/deployment-review.json\n'), true);
  assert.equal(safeIgnoreAdditions('node_modules/\n', 'node_modules/\n/plugins/\n'), false);
});


test('operator tools do not require an APK but native inputs and hook callers still do', () => {
  const tools = ['scripts/admin-notifications.mjs', 'scripts/update-release.mjs'];
  assert.deepEqual(nativeInputReasons(tools, { 'eas-build-on-success': 'node scripts/save-local-build-env.cjs' }), []);
  for (const path of ['scripts/new-tool.mjs', 'scripts/save-local-build-env.cjs', 'plugins/change.js',
    'modules/example/android/Module.kt', 'android/app/build.gradle', 'ios/Podfile', 'eas.json',
    'package-lock.json', '.fingerprintignore', 'fingerprint.config.js']) {
    assert.ok(nativeInputReasons([path], {}).length > 0, path);
  }
  for (const path of tools) for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prebuild', 'eas-build-pre-install']) {
    assert.ok(nativeInputReasons([path], { [hook]: `node ${path}` }).some(reason => reason.includes('native build hook')), `${hook}: ${path}`);
  }
});

const packageBefore = { dependencies: { expo: '58' }, scripts: { test: 'node test', postinstall: 'node native.js' } };
const dependencyAfter = { ...packageBefore, dependencies: { ...packageBefore.dependencies, 'expo-application': '58.1.2' } };
const comparison = (after = dependencyAfter, changed = ['package.json', 'package-lock.json']) =>
  ({ baseline, before: files(packageBefore), after: files(after), files: changed });

test('dependency promotion and lockfile changes permit OTA only with the complete exact fingerprint', async () => {
  const calls = [];
  const result = await compareNativeFingerprints(comparison(), async hook => {
    calls.push(hook);
    return { hash: baseline.runtimeVersion };
  });
  assert.equal(result.compatible, true);
  assert.equal(result.match, 'exact');
  assert.equal(result.rawRuntime, baseline.runtimeVersion);
  assert.deepEqual(result.exemptions, []);
  assert.deepEqual(calls, [undefined], 'never normalize dependencies to make them match');
});

test('a changed resolved native fingerprint rejects dependency or lockfile edits without normalization', async () => {
  for (const input of [comparison(), comparison(packageBefore, ['package-lock.json'])]) {
    let calls = 0;
    const result = await compareNativeFingerprints(input, async hook => {
      assert.equal(hook, undefined);
      calls++;
      return { hash: 'f'.repeat(40) };
    });
    assert.equal(result.compatible, false);
    assert.equal(result.match, null);
    assert.equal(calls, 1);
    assert.ok(result.reasons.length > 0);
  }
});

test('fingerprint failures and invalid hashes never authorize OTA', async () => {
  await assert.rejects(compareNativeFingerprints(comparison(), async () => { throw Error('cannot resolve'); }), /cannot resolve/);
  await assert.rejects(compareNativeFingerprints(comparison(), async () => ({ hash: 'unknown' })), /Invalid native fingerprint/);
  let calls = 0;
  const result = await compareNativeFingerprints({ ...comparison(), baseline: null }, async () => { calls++; });
  assert.equal(result.compatible, false);
  assert.equal(calls, 0);
});

test('exact-match path preserves native source, fingerprint config, unknown scripts and hook guards', async () => {
  const inputs = ['modules/module/android/Module.kt', 'plugins/config.js', 'android/app/build.gradle', 'ios/Podfile',
    'fingerprint.config.js', '.fingerprintignore', 'eas.json', 'scripts/new-build.mjs'];
  for (const path of inputs) {
    let calls = 0;
    const result = await compareNativeFingerprints(comparison(dependencyAfter, ['package.json', 'package-lock.json', path]),
      async () => { calls++; return { hash: baseline.runtimeVersion }; });
    assert.equal(result.compatible, false, path);
    assert.equal(calls, 0, path);
  }
  const changedHook = { ...dependencyAfter, scripts: { ...dependencyAfter.scripts, postinstall: 'node changed.js' } };
  assert.equal((await compareNativeFingerprints(comparison(changedHook), async () => ({ hash: baseline.runtimeVersion }))).compatible, false);
  const changedIgnore = comparison(); changedIgnore.after['.gitignore'] += 'plugins/\n';
  assert.equal((await compareNativeFingerprints(changedIgnore, async () => ({ hash: baseline.runtimeVersion }))).compatible, false);
});

test('administrative normalization remains available only when dependency inputs are unchanged', async () => {
  const before = files({ scripts: { 'update:production': 'old', test: 'node test' } });
  const after = files({ scripts: { 'update:production': 'new', test: 'node test' } });
  const calls = [];
  const result = await compareNativeFingerprints({ baseline, before, after, files: ['package.json'] }, async hook => {
    calls.push(hook);
    return { hash: hook ? baseline.runtimeVersion : 'f'.repeat(40) };
  });
  assert.equal(result.compatible, true);
  assert.equal(result.match, 'administrative-normalization');
  assert.deepEqual(result.exemptions, ['package-script:update:production']);
  assert.equal(calls[0], undefined);
  assert.equal(typeof calls[1], 'function');
});

test('audited admin and web tools still need a matching complete fingerprint', async () => {
  const tools = ['scripts/admin-toasts.mjs', 'scripts/secure-web-export.mjs'];
  for (const runtime of [baseline.runtimeVersion, 'f'.repeat(40)]) {
    const result = await compareNativeFingerprints(comparison(packageBefore, tools), async hook => {
      assert.equal(hook, undefined);
      return { hash: runtime };
    });
    assert.equal(result.compatible, runtime === baseline.runtimeVersion);
    assert.equal(result.needsReview, false);
  }
  await assert.rejects(compareNativeFingerprints(comparison(packageBefore, tools), async () => { throw Error('fingerprint failed'); }), /fingerprint failed/);
});

test('audited tools called by direct or indirect native hooks remain blocked', async () => {
  for (const file of ['scripts/admin-toasts.mjs', 'scripts/secure-web-export.mjs']) {
    for (const launcher of ['npm run', 'pnpm run', 'bun run', 'yarn', 'yarn run']) {
      const pkg = { ...packageBefore, scripts: { postinstall: `${launcher} build-helper`, 'build-helper': `${launcher} worker`, worker: `node ${file}` } };
      const result = await compareNativeFingerprints({ baseline, before: files(pkg), after: files(pkg), files: [file] }, async () => {
        assert.fail('native hook changes must be blocked before fingerprint acceptance');
      });
      assert.equal(result.compatible, false);
      assert.ok(result.reasons.some(r => r.includes('native build hook')));
    }
    const pkg = { ...packageBefore, scripts: { postinstall: 'npm run helper', helper: 'npm run postinstall' } };
    assert.deepEqual(nativeInputReasons([file], pkg.scripts), [], 'cyclic unrelated package scripts terminate');
  }
});

test('unclassified scripts require review rather than an automatic APK decision or OTA approval', async () => {
  const result = await compareNativeFingerprints(comparison(packageBefore, ['scripts/new-tool.mjs']), async () => {
    assert.fail('unknown scripts must be reviewed before fingerprint acceptance');
  });
  assert.equal(result.compatible, false);
  assert.equal(result.needsReview, true);
  assert.match(result.reasons[0], /Unclassified script/);
  assert.throws(() => verifyReviewDecision({ ...report(), recommendation: 'needs-review' }, {
    digest, baseline, mode: 'needs-review', exemptions: [],
  }), /require review before deployment/);
});
