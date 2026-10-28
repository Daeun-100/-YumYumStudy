import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { releaseSummary } from './deployment-review.mjs';

export function nextUpdateTag(apkTag, tags) {
  assert.match(apkTag, /^v\d+\.\d+\.\d+$/);
  const prefix = `${apkTag}-r`;
  const revisions = tags.filter(tag => tag.startsWith(prefix))
    .map(tag => tag.slice(prefix.length)).filter(value => /^[1-9]\d*$/.test(value)).map(Number);
  const revision = Math.max(0, ...revisions) + 1;
  assert.ok(Number.isSafeInteger(revision), 'Update revision overflow');
  return `${prefix}${revision}`;
}

// Adapters make retry/collision behavior testable without publishing anything.
export function publishUpdateRelease(record, plan, { git, gh, save }) {
  const summary = releaseSummary(plan.review);
  assert.equal(plan.mode, 'update');
  assert.equal(record.status, 'published', 'Only successful updates get a release');
  assert.equal(record.channel, 'production');
  assert.equal(record.platform, 'android');
  assert.equal(record.sha, plan.sha);
  assert.match(record.sha, /^[a-f0-9]{40}$/);
  assert.equal(record.apkTag, plan.baseline.tag);
  assert.equal(record.runtimeVersion, plan.runtimeVersion);
  assert.match(record.groupId, /^[a-f0-9-]{36}$/i);
  assert.match(plan.repository, /^[\w.-]+\/[\w.-]+$/);
  assert.equal(git(['rev-parse', 'HEAD']), record.sha);
  git(['fetch', 'origin', '--tags']);
  const tags = git(['tag', '--list']).split('\n').filter(Boolean);
  // Retrying this release step reuses the tag for the same update group.
  const marker = `<!-- update-group:${record.groupId} -->`;
  const releases = JSON.parse(gh(['api', `repos/${plan.repository}/releases?per_page=100`, '--paginate', '--slurp'])).flat();
  const existing = releases.find(release => release.body?.includes(marker));
  const tag = existing?.tag_name ?? record.releaseTag ?? nextUpdateTag(record.apkTag, tags);
  assert.ok(tag.startsWith(`${record.apkTag}-r`) && /^[1-9]\d*$/.test(tag.slice(`${record.apkTag}-r`.length)));
  if (tags.includes(tag)) assert.equal(git(['rev-parse', `${tag}^{commit}`]), record.sha, 'Update tag belongs to another commit');
  else {
    assert.ok(!existing, 'Release tag is missing; do not recreate published tags');
    git(['tag', tag, record.sha]);
    git(['push', 'origin', `refs/tags/${tag}`]);
  }
  // Persist the chosen tag before network writes so a partial failure can resume.
  record = { ...record, releaseTag: tag, releaseUrl: `https://github.com/${plan.repository}/releases/tag/${tag}` };
  save('update-record.json', record);
  const body = [marker, '', summary, '', '기존 APK에 적용되는 업데이트입니다. 앱 표시 버전은 그대로 유지됩니다.',
    '', '<details>', '<summary>배포 정보</summary>', '', `App version: ${record.apkTag.slice(1)}`, `Base APK: ${record.apkTag}`,
    `Commit: ${record.sha}`, `Runtime: ${record.runtimeVersion}`, `Update group: ${record.groupId}`,
    `Update ID: ${record.updateId}`, `Published at: ${record.createdAt}`, '',
    `[Update details](${record.url})`, `[Deployment run](${record.run})`,
    '', '</details>'].join('\n');
  if (existing) {
    assert.equal(existing.prerelease, false);
    // A completed release is immutable; a retry only finishes our own draft.
    if (!existing.draft) return record;
  } else {
    gh(['api', `repos/${plan.repository}/releases`, '--method', 'POST', '--input', '-'], JSON.stringify({
      tag_name: tag, target_commitish: record.sha, name: tag, body,
      draft: true, prerelease: false, make_latest: 'false',
    }));
  }
  gh(['release', 'upload', tag, 'deployment-plan.json', 'eas-update.json', 'update-record.json',
    '--repo', plan.repository, '--clobber']);
  gh(['release', 'edit', tag, '--repo', plan.repository, '--draft=false', '--latest=false']);
  return record;
}

function main() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Update releases run in GitHub Actions only');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/master');
  const plan = JSON.parse(readFileSync('deployment-plan.json', 'utf8'));
  assert.equal(plan.sha, process.env.GITHUB_SHA);
  assert.equal(plan.repository, process.env.GITHUB_REPOSITORY);
  const run = (command, args, input) => execFileSync(command, args, { encoding: 'utf8', input, maxBuffer: 16 * 1024 * 1024 }).trim();
  publishUpdateRelease(JSON.parse(readFileSync('update-record.json', 'utf8')), plan, {
    git: args => run('git', args), gh: (args, input) => run('gh', args, input),
    save: (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`),
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
