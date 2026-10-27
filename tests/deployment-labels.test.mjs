import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { treeDigest } from '../scripts/deployment-review.mjs';
const require = createRequire(import.meta.url);
const workflow = readFileSync(new URL('../.github/workflows/deployment-labels.yml', import.meta.url), 'utf8');
const source = workflow.split('          script: |\n')[1].split('\n').map(line => line.replace(/^            /, '')).join('\n');
const runScript = new (Object.getPrototypeOf(async function () {}).constructor)('github', 'context', 'core', 'require', source);
async function simulate({ stale = false, missing = false, truncated = false, blocked = false } = {}) {
  const tree = [{ path: 'src/app.ts', mode: '100644', type: 'blob', sha: 'a'.repeat(40) }];
  const review = { schema: 1, sourceTreeDigest: stale ? 'bad' : treeDigest(tree), reviewer: { kind: 'interactive-codex' },
    recommendation: 'update', rationale: 'Native compatible', evidence: ['Native proof'], blockers: blocked ? ['Missing proof'] : [] };
  const calls = [];
  const github = { rest: {
    repos: { getContent: async args => {
      calls.push(['read', args.ref]);
      if (missing) throw Error('Missing report');
      return { data: { size: 500, content: Buffer.from(JSON.stringify(review)).toString('base64') } };
    } },
    git: { getCommit: async () => ({ data: { tree: { sha: 'b'.repeat(40) } } }), getTree: async () => ({ data: { truncated, tree } }) },
    issues: {
      getLabel: async () => { throw Object.assign(Error('Missing label'), { status: 404 }); },
      createLabel: async args => calls.push(['create', args.name]),
      listLabelsOnIssue: () => {},
      removeLabel: async args => calls.push(['remove', args.name]),
      addLabels: async args => calls.push(['add', ...args.labels]),
    },
  }, paginate: async () => [{ name: 'deploy:apk' }, { name: 'priority:high' }] };
  const summary = { addHeading() { return this; }, addRaw() { return this; }, async write() {} };
  await runScript(github, { repo: { owner: 'owner', repo: 'repo' }, payload: { pull_request: { head: { sha: 'c'.repeat(40) }, number: 1 } } },
    { info() {}, summary }, require);
  return calls;
}
test('PR label follows a current review and preserves unrelated labels', async () => {
  const calls = await simulate();
  assert.ok(calls.some(call => call[0] === 'add' && call[1] === 'deploy:eas-update'));
  assert.ok(calls.some(call => call[0] === 'remove' && call[1] === 'deploy:apk'));
  assert.ok(!calls.some(call => call[0] === 'remove' && call[1] === 'priority:high'));
  assert.ok(calls.some(call => call[0] === 'read' && call[1] === 'c'.repeat(40)));
});
test('missing, stale, blocked and unverifiable PR reports are labeled needs-review', async () => {
  for (const options of [{ stale: true }, { missing: true }, { truncated: true }, { blocked: true }]) {
    const calls = await simulate(options);
    assert.ok(calls.some(call => call[0] === 'add' && call[1] === 'deploy:needs-review'));
    assert.ok(!calls.some(call => call[0] === 'add' && call[1] === 'deploy:eas-update'));
  }
});
