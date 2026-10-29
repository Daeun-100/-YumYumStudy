import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export const reviewPath = '.github/deployment-review.json';
const scriptsAllowed = ['update:test', 'update:production'];
const temporaryPaths = new Set(['deployment-plan.json', 'deployment-review.json', 'deployment-review-validation.json',
  'native-compatibility.json', 'eas-update.json', 'update-record.json', 'candidate.json', 'publication/', 'results/', 'history-input/']);
const require = createRequire(import.meta.url);
const git = (cwd, args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const sha256 = input => createHash('sha256').update(input).digest('hex');
const encode = value => `${JSON.stringify(value, null, 2)}\n`;
export function treeDigest(entries) {
  const values = entries.filter(entry => entry.type !== 'tree' && entry.path !== reviewPath)
    .map(entry => ({ path: entry.path, mode: entry.mode, type: entry.type, object: entry.object ?? entry.sha }))
    .sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  return sha256(JSON.stringify(values));
}
export function sourceSnapshot(cwd = process.cwd(), ref = 'HEAD') {
  const sha = git(cwd, ['rev-parse', ref]).trim();
  assert.match(sha, /^[a-f0-9]{40}$/);
  const entries = git(cwd, ['ls-tree', '-rz', sha]).split('\0').filter(Boolean).map(line => {
    const tab = line.indexOf('\t');
    const [mode, type, object] = line.slice(0, tab).split(' ');
    return { mode, type, object, path: line.slice(tab + 1) };
  });
  return { sourceCommit: sha, sourceTreeDigest: treeDigest(entries) };
}
export function baselineIdentity(baseline) {
  return baseline ? { tag: baseline.tag, sha: baseline.sha, runtimeVersion: baseline.runtimeVersion ?? null } : null;
}
function strings(values, name, required = false) {
  assert.ok(Array.isArray(values) && (!required || values.length > 0), `${name} must be an array${required ? ' with evidence' : ''}`);
  assert.ok(values.every(value => typeof value === 'string' && value.trim() && value.length <= 4000), `Invalid ${name}`);
  assert.equal(new Set(values).size, values.length, `Duplicate ${name}`);
}
export function releaseSummary(review) {
  strings(review?.releaseNotes, 'releaseNotes', true);
  assert.ok(review.releaseNotes.join('\n').length <= 6000, 'Release notes exceed 6000 characters');
  return `## 변경사항\n\n${review.releaseNotes.map(note => `- ${note.trim()}`).join('\n')}`;
}
export function validateReview(review, digest) {
  assert.equal(review.schema, 1, 'Unsupported deployment review schema');
  assert.match(review.sourceCommit, /^[a-f0-9]{40}$/);
  assert.match(review.sourceTreeDigest, /^[a-f0-9]{64}$/);
  assert.equal(review.sourceTreeDigest, digest, 'Deployment review is stale: review the current source tree again');
  assert.equal(review.reviewer?.kind, 'interactive-codex');
  assert.ok(['update', 'apk', 'skip', 'needs-review'].includes(review.recommendation));
  assert.ok(typeof review.rationale === 'string' && review.rationale.trim().length > 0 && review.rationale.length <= 12000);
  strings(review.evidence, 'evidence', true);
  strings(review.exemptions, 'exemptions');
  strings(review.blockers, 'blockers');
  releaseSummary(review);
  for (const exemption of review.exemptions) assert.ok([
    ...scriptsAllowed.map(name => `package-script:${name}`), 'ignore-additions:.gitignore', 'ignore-additions:.easignore',
  ].includes(exemption), `Unsupported exemption: ${exemption}`);
  if (review.baseline !== null) {
    assert.ok(review.baseline && typeof review.baseline === 'object', 'Missing APK baseline');
    assert.match(review.baseline.tag, /^v\d+\.\d+\.\d+$/);
    assert.match(review.baseline.sha, /^[a-f0-9]{40}$/);
    if (review.baseline.runtimeVersion !== null) assert.match(review.baseline.runtimeVersion, /^[a-f0-9]{40,64}$/i);
  }
  return review;
}
export function verifyReviewDecision(review, { digest, baseline, mode, exemptions }) {
  validateReview(review, digest);
  assert.deepEqual(review.baseline, baselineIdentity(baseline), 'Published APK baseline changed; refresh the review');
  assert.deepEqual([...review.exemptions].sort(), [...exemptions].sort(), 'Declared deployment exemptions differ from verified changes');
  assert.equal(review.blockers.length, 0, 'Deployment review has unresolved blockers');
  assert.equal(review.recommendation, mode, `Review recommends ${review.recommendation}; deterministic checks require ${mode}`);
  return review;
}
export function readReview(cwd = process.cwd()) {
  const value = JSON.parse(readFileSync(`${cwd}/${reviewPath}`, 'utf8'));
  return validateReview(value, sourceSnapshot(cwd).sourceTreeDigest);
}
const activeRules = text => text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
export function safeIgnoreAdditions(before, after) {
  const old = activeRules(before), next = activeRules(after);
  let index = 0;
  for (const rule of next) {
    if (rule === old[index]) { index++; continue; }
    if (!temporaryPaths.has(rule.replace(/^\//, ''))) return false;
  }
  return index === old.length;
}
export function inspectAdministrativeChanges(before, after) {
  const exemptions = [], reasons = [];
  const oldPackage = JSON.parse(before['package.json']), newPackage = JSON.parse(after['package.json']);
  const oldScripts = oldPackage.scripts ?? {}, newScripts = newPackage.scripts ?? {};
  for (const name of scriptsAllowed) {
    if (oldScripts[name] !== newScripts[name]) {
      const referenced = [...Object.entries(oldScripts), ...Object.entries(newScripts)]
        .some(([key, command]) => !scriptsAllowed.includes(key) && String(command).includes(name));
      if (referenced) reasons.push(`Deployment shortcut ${name} is referenced by another package script`);
      exemptions.push(`package-script:${name}`);
    }
  }
  const strip = value => ({ ...value, scripts: Object.fromEntries(Object.entries(value.scripts ?? {}).filter(([key]) => !scriptsAllowed.includes(key))) });
  try { assert.deepEqual(strip(oldPackage), strip(newPackage)); }
  catch { reasons.push('Package metadata, dependencies, or non-deployment scripts changed'); }
  for (const file of ['.gitignore', '.easignore']) {
    if (before[file] !== after[file]) {
      if (safeIgnoreAdditions(before[file], after[file])) exemptions.push(`ignore-additions:${file}`);
      else reasons.push(`${file} changed outside the permitted temporary deployment paths`);
    }
  }
  return { exemptions: exemptions.sort(), reasons, oldScripts };
}
export function normalizationHook(before, oldScripts) {
  return (source, chunk, end) => {
    if (source.type === 'file' && ['.gitignore', '.easignore'].includes(source.filePath)) return end ? before[source.filePath] : null;
    if (source.type === 'contents' && source.id === 'packageJson:scripts') {
      const current = JSON.parse(String(chunk));
      return JSON.stringify(Object.fromEntries(Object.entries(oldScripts)
        .filter(([name]) => Object.hasOwn(current, name) || scriptsAllowed.includes(name))));
    }
    return chunk;
  };
}
export function nativeInputReasons(files, scripts) {
  const reasons = [];
  // Audited operator/CI tools; full fingerprint equality is still required.
  const adminScript = /^(deployment(?:-review|-history)?|release-candidate|check-release|build-record|publish-release-info|admin-notifications|update-release)\.mjs$/;
  for (const file of files) {
    const nativeHooks = Object.entries(scripts).filter(([name]) => /^(preinstall|install|postinstall|prepare|prebuild|eas-build)/.test(name));
    if (file.startsWith('scripts/') && nativeHooks.some(([, command]) => String(command).includes(file))) {
      reasons.push(`Changed script is called by a native build hook: ${file}`);
    }
    if (/^(android\/|ios\/|modules\/|plugins\/|fingerprint\.config\.|\.fingerprintignore$|eas\.json$|package-lock\.json$)/.test(file)
      || (file.startsWith('scripts/') && !adminScript.test(file.slice(8)))) reasons.push(`Native/build input changed: ${file}`);
  }
  return reasons;
}
const dependencyFields = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
function withoutDependencyDeclarations(files) {
  const pkg = JSON.parse(files['package.json']);
  for (const name of dependencyFields) delete pkg[name];
  return { ...files, 'package.json': JSON.stringify(pkg) };
}

/** Dependency declarations may change without changing the resolved native graph.
 * Only an unmodified, complete fingerprint can prove that case; normalization
 * must never hide dependency changes, native hooks, sources or ignore rules.
 */
export async function compareNativeFingerprints({ baseline, before, after, files }, fingerprint) {
  const result = (compatible, exemptions, reasons, rawRuntime = null, normalizedRuntime = null, match = null) =>
    ({ compatible, exemptions, reasons, rawRuntime, normalizedRuntime, match });
  if (!baseline?.runtimeVersion) return result(false, [], ['No published fingerprint runtime']);
  const analysis = inspectAdministrativeChanges(before, after);
  const newScripts = JSON.parse(after['package.json']).scripts ?? {};
  const inputReasons = paths => [...new Set([
    ...nativeInputReasons(paths, analysis.oldScripts), ...nativeInputReasons(paths, newScripts),
  ])];
  const exactAnalysis = inspectAdministrativeChanges(
    withoutDependencyDeclarations(before), withoutDependencyDeclarations(after));
  const exactReasons = [...exactAnalysis.reasons, ...inputReasons(files.filter(file => file !== 'package-lock.json'))];
  const resolve = async hook => {
    const value = await fingerprint(hook);
    assert.match(value.hash, /^[a-f0-9]{40,64}$/i, 'Invalid native fingerprint');
    return value.hash;
  };
  let rawRuntime = null;
  if (exactReasons.length === 0) {
    rawRuntime = await resolve();
    if (rawRuntime === baseline.runtimeVersion) return result(true, [], [], rawRuntime, rawRuntime, 'exact');
  }
  const reasons = [...new Set([...analysis.reasons, ...inputReasons(files)])];
  if (reasons.length) return result(false, analysis.exemptions, reasons, rawRuntime);
  const normalizedRuntime = await resolve(normalizationHook(before, analysis.oldScripts));
  const compatible = normalizedRuntime === baseline.runtimeVersion;
  return result(compatible, analysis.exemptions,
    compatible ? [] : ['Unexplained native fingerprint differences remain'], rawRuntime, normalizedRuntime,
    compatible ? 'administrative-normalization' : null);
}

export async function nativeCompatibility(cwd, baseline) {
  if (!baseline?.runtimeVersion) return { compatible: false, exemptions: [], reasons: ['No published fingerprint runtime'], normalizedRuntime: null };
  const before = {}, after = {};
  for (const file of ['package.json', '.gitignore', '.easignore']) {
    before[file] = git(cwd, ['show', `${baseline.sha}:${file}`]);
    after[file] = readFileSync(`${cwd}/${file}`, 'utf8');
  }
  const files = git(cwd, ['diff', '--name-only', baseline.sha, 'HEAD']).trim().split('\n').filter(Boolean);
  const { createFingerprintAsync } = require('expo/fingerprint');
  return compareNativeFingerprints({ baseline, before, after, files }, hook =>
    createFingerprintAsync(cwd, { platforms: ['android'], ignorePaths: ['android/**/*', 'ios/**/*'],
      silent: true, ...(hook ? { fileHookTransform: hook } : {}) }));
}

function main() {
  if (process.argv[2] === 'snapshot') {
    console.log(encode(sourceSnapshot()).trim()); return;
  }
  if (process.argv[2] === 'check') {
    const report = readReview();
    assert.notEqual(report.recommendation, 'needs-review', 'Release requires review before merge');
    assert.equal(report.blockers.length, 0, 'Review contains blockers');
    console.log(`Deployment review valid: ${report.recommendation}`); return;
  }
  throw new Error('Expected snapshot or check');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
