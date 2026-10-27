import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const branch = 'refs/heads/deployment-history';
const filenames = new Set(['deployment-review.json', 'deployment-review-validation.json', 'native-compatibility.json', 'deployment-plan.json', 'eas-update.json', 'update-record.json',
  'android-build.json', 'web-deployment.json', 'build-record.json', 'candidate.json', 'release.json']);
const encode = value => `${JSON.stringify(value, null, 2)}\n`;
export function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, /token|secret|password|authorization|api.?key|webhook/i.test(key) ? '[redacted]' : redactSecrets(item)]));
  return value;
}
export function collectRecords(directory) {
  const records = new Map();
  if (!existsSync(directory)) return records;
  for (const artifact of readdirSync(directory, { withFileTypes: true })) {
    if (!artifact.isDirectory() || !/^[a-zA-Z0-9_.-]+$/.test(artifact.name)) continue;
    for (const name of filenames) {
      const path = join(directory, artifact.name, name);
      if (!existsSync(path)) continue;
      const stat = lstatSync(path);
      assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'History inputs must be regular JSON files');
      assert.ok(stat.size <= 2 * 1024 * 1024, 'Deployment JSON exceeds 2 MiB');
      records.set(`artifacts/${artifact.name}/${name}`, encode(redactSecrets(JSON.parse(readFileSync(path, 'utf8')))));
    }
  }
  return records;
}
export function archiveHistory({ repositoryDir, sourceDir, metadata, remote = 'origin' }) {
  assert.match(metadata.runId, /^[1-9][0-9]*$/);
  assert.match(metadata.attempt, /^[1-9][0-9]*$/);
  assert.match(metadata.sha, /^[a-f0-9]{40}$/);
  const prefix = `runs/${metadata.runId}/attempt-${metadata.attempt}`;
  const records = collectRecords(sourceDir);
  records.set('run.json', encode({ ...metadata, files: [...records].map(([path, content]) => ({
    path, sha256: createHash('sha256').update(content).digest('hex'), bytes: Buffer.byteLength(content),
  })) }));
  const directory = mkdtempSync(join(tmpdir(), 'yumyum-history-index-'));
  // A separate Git index writes only history JSON. Never checkout or reset master.
  const env = { ...process.env, GIT_INDEX_FILE: join(directory, 'index'),
    GIT_AUTHOR_NAME: 'github-actions[bot]', GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
    GIT_COMMITTER_NAME: 'github-actions[bot]', GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com' };
  const gitResult = (args, input) => spawnSync('git', ['-C', repositoryDir, ...args],
    { env, input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 30000 });
  const git = (args, input) => {
    const result = gitResult(args, input);
    if (result.error || result.status !== 0) throw new Error(`History Git ${args[0]} failed: ${result.error?.message ?? result.stderr}`);
    return result.stdout.trim();
  };
  try {
    for (let retry = 0; retry < 3; retry++) {
      const lookup = gitResult(['ls-remote', '--exit-code', '--heads', remote, branch]);
      assert.ok(!lookup.error && [0, 2].includes(lookup.status), 'Could not read deployment-history remote branch');
      let parent = null;
      if (lookup.status === 0) {
        git(['fetch', '--no-tags', remote, branch]);
        parent = git(['rev-parse', 'FETCH_HEAD']);
        git(['read-tree', parent]);
      } else git(['read-tree', '--empty']);
      for (const [path, content] of records) {
        const target = `${prefix}/${path}`;
        const blob = git(['hash-object', '-w', '--stdin'], content);
        if (parent) {
          const existing = git(['ls-tree', parent, '--', target]);
          if (existing) assert.equal(existing.split(/\s/)[2], blob, `History entry already exists with different contents: ${target}`);
        }
        git(['update-index', '--add', '--cacheinfo', '100644', blob, target]);
      }
      const tree = git(['write-tree']);
      if (parent && tree === git(['rev-parse', `${parent}^{tree}`])) return { commit: parent, prefix, unchanged: true };
      const commit = git(['commit-tree', tree, ...(parent ? ['-p', parent] : []),
        '-m', `Record deployment ${metadata.runId} attempt ${metadata.attempt} [skip ci]`]);
      // Normal fast-forward push only. A concurrent archive is re-read and preserved.
      const pushed = gitResult(['push', remote, `${commit}:${branch}`]);
      if (!pushed.error && pushed.status === 0) return { commit, prefix, unchanged: false };
      if (retry === 2) throw new Error(`Could not append deployment history: ${pushed.error?.message ?? pushed.stderr}`);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
export function historyMetadata(env) {
  assert.equal(env.GITHUB_ACTIONS, 'true', 'History writes run in GitHub Actions only');
  assert.equal(env.GITHUB_REF, 'refs/heads/master', 'Only master deployment runs can write history');
  assert.match(env.GITHUB_REPOSITORY, /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/);
  const needs = JSON.parse(env.DEPLOYMENT_JOB_RESULTS);
  const jobs = Object.fromEntries(Object.entries(needs).map(([name, job]) => [name, {
    result: job.result,
    ...(job.outputs?.mode ? { mode: job.outputs.mode } : {}),
  }]));
  return { schema: 1, repository: env.GITHUB_REPOSITORY, sha: env.GITHUB_SHA,
    runId: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT, workflow: env.GITHUB_WORKFLOW,
    run: `https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}/attempts/${env.GITHUB_RUN_ATTEMPT}`,
    jobs };
}
function main() {
  const metadata = historyMetadata(process.env);
  const result = archiveHistory({ repositoryDir: process.cwd(), sourceDir: resolve('history-input'), metadata });
  const url = `https://github.com/${metadata.repository}/tree/deployment-history/${result.prefix}`;
  console.log(`Deployment JSON archived at ${url}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `\n## Durable deployment history\n\n[Run ${metadata.runId}, attempt ${metadata.attempt}](${url})\n\nHistory commit: ${result.commit}\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
