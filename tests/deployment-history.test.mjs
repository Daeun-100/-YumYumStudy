import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { archiveHistory, collectRecords, historyMetadata, redactSecrets } from '../scripts/deployment-history.mjs';

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'yumyum-history-test-'));
  const remote = join(root, 'remote.git'), repo = join(root, 'checkout'), source = join(root, 'inputs');
  const call = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  call(['init', '--bare', remote]);
  call(['clone', remote, repo]);
  call(['checkout', '-b', 'master'], repo);
  call(['config', 'user.name', 'Test'], repo); call(['config', 'user.email', 'test@example.invalid'], repo);
  writeFileSync(join(repo, 'app.txt'), 'source');
  call(['add', 'app.txt'], repo); call(['commit', '-m', 'Initial source'], repo); call(['push', 'origin', 'master'], repo);
  // A staged change must also survive history recording unchanged.
  writeFileSync(join(repo, 'app.txt'), 'staged source'); call(['add', 'app.txt'], repo);
  const sha = call(['rev-parse', 'HEAD'], repo);
  mkdirSync(join(source, 'production-update'), { recursive: true });
  writeFileSync(join(source, 'production-update', 'update-record.json'), JSON.stringify({ sha, status: 'published' }));
  writeFileSync(join(source, 'production-update', 'deployment-review.json'), JSON.stringify({ recommendation: 'update', sourceCommit: sha }));
  const metadata = { schema: 1, runId: '123', attempt: '1', sha, jobs: { update: { result: 'success' } } };
  return { root, remote, repo, source, sha, metadata, git: args => call(args, repo) };
};

test('history starts on an isolated root, appends, and never changes master or the working index', () => {
  const f = fixture();
  try {
    const status = f.git(['status', '--porcelain']);
    const first = archiveHistory({ repositoryDir: f.repo, sourceDir: f.source, metadata: f.metadata });
    assert.equal(f.git(['rev-parse', 'HEAD']), f.sha);
    assert.equal(f.git(['status', '--porcelain']), status);
    assert.equal(f.git(['ls-remote', 'origin', 'refs/heads/master']).split(/\s/)[0], f.sha);
    assert.equal(f.git(['rev-list', '--parents', '-n', '1', first.commit]), first.commit);
    const files = f.git(['ls-tree', '-r', '--name-only', first.commit]).split('\n');
    assert.ok(files.every(file => file.startsWith('runs/123/attempt-1/')));
    assert.ok(!files.some(file => file.includes('app.txt')));
    assert.ok(files.some(file => file.endsWith('/deployment-review.json')));
    const second = archiveHistory({ repositoryDir: f.repo, sourceDir: f.source, metadata: { ...f.metadata, attempt: '2' } });
    assert.equal(f.git(['rev-parse', `${second.commit}^`]), first.commit);
    assert.ok(f.git(['show', `${second.commit}:runs/123/attempt-1/run.json`]).includes('success'));
    assert.equal(f.git(['status', '--porcelain']), status);
    const duplicate = archiveHistory({ repositoryDir: f.repo, sourceDir: f.source, metadata: { ...f.metadata, attempt: '2' } });
    assert.equal(duplicate.commit, second.commit);
    assert.equal(duplicate.unchanged, true);
    assert.throws(() => archiveHistory({ repositoryDir: f.repo, sourceDir: f.source,
      metadata: { ...f.metadata, attempt: '2', jobs: { update: { result: 'failure' } } } }), /already exists/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('failed deployments are archived even when no route produced JSON artifacts', () => {
  const f = fixture();
  try {
    const result = archiveHistory({ repositoryDir: f.repo, sourceDir: join(f.root, 'missing'),
      metadata: { ...f.metadata, jobs: { prepare: { result: 'failure' }, update: { result: 'skipped' } } } });
    const entry = JSON.parse(f.git(['show', `${result.commit}:${result.prefix}/run.json`]));
    assert.equal(entry.jobs.prepare.result, 'failure');
    assert.deepEqual(entry.files, []);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('archive only allowlisted JSON, redact credentials, and reject invalid JSON', () => {
  const root = mkdtempSync(join(tmpdir(), 'yumyum-history-input-'));
  try {
    const directory = join(root, 'update'); mkdirSync(directory);
    writeFileSync(join(directory, 'update-record.json'), JSON.stringify({ id: 'update', token: 'private', nested: { password: 'private' } }));
    writeFileSync(join(directory, 'console.log'), 'console logs stay in Actions');
    writeFileSync(join(directory, '.env'), 'TOKEN=private');
    const records = collectRecords(root);
    assert.equal(records.size, 1);
    assert.deepEqual(JSON.parse([...records.values()][0]), { id: 'update', token: '[redacted]', nested: { password: '[redacted]' } });
    writeFileSync(join(directory, 'eas-update.json'), 'not JSON');
    assert.throws(() => collectRecords(root));
    assert.deepEqual(redactSecrets([{ secret: 'value', sha: 'abc' }]), [{ secret: '[redacted]', sha: 'abc' }]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('history entry validation prevents local writes and path injection', () => {
  const env = { GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/master', GITHUB_REPOSITORY: 'owner/repo',
    GITHUB_SHA: 'a'.repeat(40), GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2', GITHUB_WORKFLOW: 'Cloud Build',
    DEPLOYMENT_JOB_RESULTS: JSON.stringify({ update: { result: 'success', outputs: { token: 'not recorded' } } }) };
  const metadata = historyMetadata(env);
  assert.deepEqual(metadata.jobs, { update: { result: 'success' } });
  assert.throws(() => historyMetadata({ ...env, GITHUB_REF: 'refs/heads/deployment-history' }));
  assert.throws(() => historyMetadata({ ...env, GITHUB_ACTIONS: '' }));
  assert.throws(() => archiveHistory({ metadata: { ...metadata, runId: '../master' } }));
});

test('history collection runs after failed routes and receives branch write permission', () => {
  const workflow = readFileSync(new URL('../.github/workflows/cloud-build.yml', import.meta.url), 'utf8');
  const history = workflow.slice(workflow.indexOf('\n  history:'));
  assert.match(history, /needs: \[prepare, android, web, record, update\]/);
  assert.match(history, /if: always\(\).*refs\/heads\/master/);
  assert.match(history, /contents: write/);
  assert.match(history, /deployment-history.mjs/);
  assert.match(workflow, /candidate-metadata-/);
});
