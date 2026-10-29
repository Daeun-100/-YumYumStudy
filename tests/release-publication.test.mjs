import test from 'node:test';
import assert from 'node:assert/strict';
import { apkReleaseNotes, candidateFromBuilds, releaseNoticeNotes, validateCandidate } from '../scripts/release-candidate.mjs';
import { preventRollback, releaseRows } from '../scripts/publish-release-info.mjs';
const sha = 'a'.repeat(40);
const app = { version: '1.0.1', android: { versionCode: 2, package: 'com.yumyumstudy.app' } };
function fixture() {
  return { app, sha, repository: 'owner/repo', runId: '12', apk: Buffer.from('apk'),
    android: [{ id: '11111111-1111-4111-8111-111111111111', updateChannel: { name: 'production' }, runtime: { version: 'c'.repeat(40) }, status: 'FINISHED', platform: 'ANDROID', buildProfile: 'production', appIdentifier: app.android.package,
      gitCommitHash: sha, appVersion: app.version, appBuildVersion: '2' }],
    web: { identifier: `production-${sha.slice(0, 12)}-8-1` },
    records: Array.from({ length: 2 }, () => ({ variant: 'production', commit: sha, version: app.version,
      revision: 2, run: 'https://github.com/owner/repo/actions/runs/12' })) };
}
test('completed matching builds produce a candidate bound to tag, SHA and APK digest', () => {
  const candidate = candidateFromBuilds(fixture());
  assert.equal(candidate.apkName, 'yumyumstudy-v1.0.1.apk');
  assert.equal(validateCandidate(candidate, app, 'v1.0.1', 'owner/repo'), candidate);
  assert.throws(() => validateCandidate(candidate, app, 'v1.0.2', 'owner/repo'));
  assert.throws(() => validateCandidate(candidate, app, 'v1.0.1', 'another/repo'));
});
test('reject test, failed, mismatched-code and mismatched-version APKs', () => {
  for (const patch of [{ buildProfile: 'test' }, { status: 'ERRORED' }, { gitCommitHash: 'b'.repeat(40) },
    { appBuildVersion: '1' }, { updateChannel: { name: 'test' } }, { runtime: null }, { appIdentifier: 'com.yumyumstudy.app.test' }]) {
    const input = fixture(); Object.assign(input.android[0], patch);
    assert.throws(() => candidateFromBuilds(input));
  }
});
test('reject test web and artifact records from another build', () => {
  const input = fixture(); input.web.identifier = `test-${sha.slice(0, 12)}-8-1`;
  assert.throws(() => candidateFromBuilds(input));
  input.web.identifier = `production-${sha.slice(0, 12)}-8-1`;
  input.records[1].run = 'https://github.com/owner/repo/actions/runs/13';
  assert.throws(() => candidateFromBuilds(input));
});
test('publish stable APK URL and fixed web URL as enabled platform rows', () => {
  const rows = releaseRows({ revision: 2, version: '1.0.1', notes: 'Fix', downloadUrl: 'https://github.com/owner/repo/releases/download/v1.0.1/app.apk' }, 'yumyumstudy-daeun100');
  assert.equal(rows[0].enabled, true);
  assert.equal(rows[1].download_url, 'https://yumyumstudy-daeun100.expo.app');
  assert.throws(() => releaseRows({}, 'bad/domain'));
  preventRollback([{ ...rows[0], revision: 1 }], rows);
  preventRollback(rows, rows); // Re-running after a partial failure is safe.
  assert.throws(() => preventRollback([{ ...rows[0], revision: 3 }], rows));
  assert.throws(() => preventRollback([{ ...rows[0], download_url: 'https://different.test/app.apk' }], rows));
});


test('APK release leads with the reviewed user summary and rejects missing notes', () => {
  const notes = ['관리자가 지정한 연차 날짜를 앱에서 확인할 수 있습니다.'];
  const release = { version: '1.0.3', revision: 4, sha };
  const body = apkReleaseNotes({ releaseNotes: notes }, release);
  assert.ok(body.startsWith(`## 변경사항\n\n- ${notes[0]}`));
  assert.ok(body.indexOf(notes[0]) < body.indexOf(sha));
  assert.throws(() => apkReleaseNotes({}, release), /releaseNotes/);
});

test('Android and web notices contain only the APK source reviewed user summary', () => {
  const digest = 'd'.repeat(64);
  const review = { schema: 1, sourceCommit: sha, sourceTreeDigest: digest, baseline: null,
    reviewer: { kind: 'interactive-codex' }, recommendation: 'apk', rationale: 'APK version increased',
    evidence: ['Operator evidence must stay out of the notice'], exemptions: [], blockers: [],
    releaseNotes: [' 목표 달성 알림을 볼 수 있어요. ', '연차일에도 공부 시간을 확인할 수 있어요.'] };
  const notes = releaseNoticeNotes(review, digest);
  const rows = releaseRows({ revision: 4, version: '1.1.0', notes, downloadUrl: 'https://example.com/app.apk' }, 'yumyumstudy');
  for (const row of rows) {
    assert.equal(row.notes, '• 목표 달성 알림을 볼 수 있어요.\n• 연차일에도 공부 시간을 확인할 수 있어요.');
    assert.doesNotMatch(row.notes, /##|<details>|<summary>|Commit:|빌드 번호|배포 후보|Operator|[a-f0-9]{40}/);
  }
  assert.throws(() => releaseNoticeNotes(review, 'e'.repeat(64)), /stale/);
  assert.throws(() => releaseNoticeNotes({ ...review, releaseNotes: [] }, digest), /releaseNotes/);
  assert.throws(() => releaseNoticeNotes({ ...review, blockers: ['Server missing'] }, digest), /completed deployment review/);
});
