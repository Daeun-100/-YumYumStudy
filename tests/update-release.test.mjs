import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextUpdateTag, publishUpdateRelease } from '../scripts/update-release.mjs';
import { newestRelease } from '../scripts/deployment.mjs';

const sha = 'a'.repeat(40), runtimeVersion = 'b'.repeat(40);
const record = { status: 'published', channel: 'production', platform: 'android', sha, runtimeVersion,
  apkTag: 'v1.0.2', groupId: '11111111-1111-4111-8111-111111111111', updateId: '22222222-2222-4222-8222-222222222222',
  url: 'https://expo.dev/update', run: 'https://github.com/owner/repo/actions/runs/1', message: 'Fix screen', createdAt: '2026-10-28' };
const plan = { mode: 'update', sha, runtimeVersion, baseline: { tag: record.apkTag }, repository: 'owner/repo' };
function fixture({ tags = [], releases = [], tagSha = sha } = {}) {
  const calls = [], files = {};
  return { calls, files, git(args) {
    calls.push(['git', ...args]);
    if (args[0] === 'rev-parse') return args[1] === 'HEAD' ? sha : tagSha;
    if (args[0] === 'tag' && args[1] === '--list') return tags.join('\n');
    return '';
  }, gh(args, input) {
    calls.push(['gh', ...args, ...(input ? [JSON.parse(input)] : [])]);
    if (args.includes('--slurp')) return JSON.stringify([releases]);
    return '';
  }, save(path, value) { files[path] = value; } };
}
test('revision increases numerically, counts reserved tags, and resets per APK', () => {
  assert.equal(nextUpdateTag('v1.0.2', ['v1.0.2-r2', 'v1.0.2-r10', 'v1.0.3-r99', 'v1.0.2-r01']), 'v1.0.2-r11');
  assert.equal(nextUpdateTag('v1.0.3', ['v1.0.2-r10']), 'v1.0.3-r1');
  assert.throws(() => nextUpdateTag('v1.0.2-r1', []));
});
test('successful update creates exact commit tag, draft with records, then publishes without Latest', () => {
  const io = fixture();
  const result = publishUpdateRelease(record, plan, io);
  assert.equal(result.releaseTag, 'v1.0.2-r1');
  assert.ok(io.calls.some(call => call.join(' ') === `git tag v1.0.2-r1 ${sha}`));
  const create = io.calls.find(call => call.includes('POST')).at(-1);
  assert.equal(create.make_latest, 'false');
  assert.equal(create.prerelease, false);
  assert.equal(create.draft, true);
  assert.match(create.body, /Fix screen/);
  const uploadIndex = io.calls.findIndex(call => call.includes('upload'));
  const publishIndex = io.calls.findIndex(call => call.includes('--draft=false'));
  assert.ok(uploadIndex > 0 && publishIndex > uploadIndex);
  assert.ok(io.calls[publishIndex].includes('--latest=false'));
  assert.equal(io.files['update-record.json'].releaseTag, result.releaseTag);
});
test('retry resumes own draft and published group remains immutable', () => {
  for (const draft of [true, false]) {
    const io = fixture({ tags: ['v1.0.2-r3'], releases: [{ tag_name: 'v1.0.2-r3', draft,
      prerelease: false, body: `<!-- update-group:${record.groupId} -->` }] });
    assert.equal(publishUpdateRelease(record, plan, io).releaseTag, 'v1.0.2-r3');
    assert.ok(!io.calls.some(call => call.includes('POST') || call.includes('push')));
    assert.equal(io.calls.some(call => call.includes('upload')), draft);
  }
});
test('retry after tag creation uses recorded tag and refuses moved tags', () => {
  const tagged = { ...record, releaseTag: 'v1.0.2-r4' };
  assert.equal(publishUpdateRelease(tagged, plan, fixture({ tags: [tagged.releaseTag] })).releaseTag, tagged.releaseTag);
  assert.throws(() => publishUpdateRelease(tagged, plan,
    fixture({ tags: [tagged.releaseTag], tagSha: 'c'.repeat(40) })), /another commit/);
});
test('failed, test, wrong commit, wrong APK and wrong runtime records never mutate remote', () => {
  for (const patch of [{ status: 'failed' }, { channel: 'test' }, { sha: 'c'.repeat(40) },
    { apkTag: 'v1.0.1' }, { runtimeVersion: 'c'.repeat(40) }]) {
    const io = fixture();
    assert.throws(() => publishUpdateRelease({ ...record, ...patch }, plan, io));
    assert.equal(io.calls.length, 0);
  }
});
test('revision releases cannot replace APK baseline or enter APK publication workflow', () => {
  const apk = { tag_name: 'v1.0.2', draft: false, prerelease: false };
  assert.equal(newestRelease([apk, { ...apk, tag_name: 'v1.0.2-r99' }]), apk);
  const workflow = readFileSync(new URL('../.github/workflows/publish-release.yml', import.meta.url), 'utf8');
  assert.match(workflow, /!contains\(github.event.release.tag_name, '-'\)/);
  const cloud = readFileSync(new URL('../.github/workflows/cloud-build.yml', import.meta.url), 'utf8');
  assert.ok(cloud.indexOf('deployment.mjs publish') < cloud.indexOf('node scripts/update-release.mjs'));
});
