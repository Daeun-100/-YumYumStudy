import { readFileSync,writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const app=JSON.parse(readFileSync('app.json')).expo;
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const record={variant:process.env.EXPO_PUBLIC_APP_VARIANT,version:app.version,revision:app.android.versionCode,
 commit:sha,run:`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
 createdAt:new Date().toISOString(),published:false};
writeFileSync('build-record.json',JSON.stringify(record,null,2)+'\n');
