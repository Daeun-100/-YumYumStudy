import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const app = JSON.parse(readFileSync('app.json')).expo;
const pkg = JSON.parse(readFileSync('package.json'));
assert.match(app.version, /^\d+\.\d+\.\d+$/, 'Use a numeric release version');
assert.equal(app.version, pkg.version, 'App and package versions must match');
assert.ok(Number.isSafeInteger(app.android.versionCode) && app.android.versionCode > 0);
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const tag = `v${app.version}`;
const exists = execFileSync('git', ['tag', '--list', tag], {encoding:'utf8'}).trim();
if (exists) assert.equal(execFileSync('git',['rev-list','-n','1',tag],{encoding:'utf8'}).trim(),sha,'Release version already belongs to another commit');
const tags = execFileSync('git',['tag','--list','v*'],{encoding:'utf8'}).trim().split('\n').filter(t=>/^v\d+\.\d+\.\d+$/.test(t)&&t!==tag);
for (const previous of tags) {
  const old = JSON.parse(execFileSync('git',['show',`${previous}:app.json`],{encoding:'utf8'})).expo;
  assert.ok(app.android.versionCode > old.android.versionCode, `Build number must exceed ${previous}`);
  const parts = app.version.split('.').map(Number), prior = old.version.split('.').map(Number);
  assert.ok(parts.some((p,i)=>p>prior[i]&&parts.slice(0,i).every((v,j)=>v===prior[j])),`Version must exceed ${previous}`);
}
console.log(JSON.stringify({version:app.version,revision:app.android.versionCode,tag,sha},null,2));
