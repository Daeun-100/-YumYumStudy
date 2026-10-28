import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { baselineIdentity, inspectAdministrativeChanges, nativeInputReasons, normalizationHook, safeIgnoreAdditions, sourceSnapshot, treeDigest,
  validateReview, verifyReviewDecision } from '../scripts/deployment-review.mjs';
const digest = 'd'.repeat(64);
const baseline = { sha: 'a'.repeat(40), tag: 'v1.0.1', runtimeVersion: 'c'.repeat(40) };
const report = () => ({ schema: 1, sourceCommit: 'b'.repeat(40), sourceTreeDigest: digest, baseline: baselineIdentity(baseline),
  reviewer: { kind: 'interactive-codex' }, recommendation: 'update', rationale: 'JS changes, native runtime verified',
  evidence: ['Native fingerprint matches published APK after verified administrative normalization'], exemptions: [], blockers: [] });
test('review is bound to exact source content, published APK and deterministic route', () => {
  const r = report();
  assert.equal(verifyReviewDecision(r, { digest, baseline, mode: 'update', exemptions: [] }), r);
  for (const patch of [{ sourceTreeDigest: 'e'.repeat(64) }, { schema: 2 }, { reviewer: { kind: 'ci-ai' } },
    { recommendation: 'force-update' }, { evidence: [] }, { exemptions: ['ignore:package.json'] }, { baseline: {} }]) {
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
