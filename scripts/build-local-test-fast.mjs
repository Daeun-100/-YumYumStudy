import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const cache = path.join(root, 'builds/local-test-cache');
const output = path.join(root, 'builds/yumyumstudy-test.apk');
const args = process.argv.slice(2);
if (args.some(arg => !['--non-interactive', '--refresh'].includes(arg))) {
  throw new Error('Supported fast-build options: --non-interactive, --refresh');
}
fs.mkdirSync(cache, { recursive: true, mode: 0o700 });
fs.chmodSync(cache, 0o700);
const lock = path.join(cache, '.lock');
try { fs.mkdirSync(lock); } catch { throw new Error(`Fast build is already running. If interrupted, remove ${lock} after checking no build is running.`); }
const started = Date.now();
function run(command, argv, options = {}) {
  const result = spawnSync(command, argv, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}
function inspectApk(apk) {
  const toolsRoot = path.join(process.env.ANDROID_HOME, 'build-tools');
  const version = fs.readdirSync(toolsRoot).filter(name => /^\d+(\.\d+)*$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
  function read(tool, argv) {
    const result = spawnSync(path.join(toolsRoot, version, tool), argv, { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`APK verification failed: ${tool}`);
    return result.stdout;
  }
  const badging = read('aapt', ['dump', 'badging', apk]);
  if (!badging.includes("package: name='com.yumyumstudy.app.test'") || !badging.includes("native-code: 'arm64-v8a'")) throw new Error('Expected ARM64 test APK.');
  const certificate = read('apksigner', ['verify', '--print-certs', apk]).match(/certificate SHA-256 digest: ([a-f0-9]+)/i)?.[1];
  if (!certificate) throw new Error('APK signing certificate missing.');
  return certificate;
}
// Anything that can affect native generation invalidates the whole workspace.
// Keep old workspaces on disk until a replacement has built successfully.
function fingerprint() {
  const hash = crypto.createHash('sha256').update('fast-local-v1');
  function add(relative) {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) return;
    if (fs.statSync(absolute).isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) {
        if (!['node_modules', 'build', '.gradle', '.cxx'].includes(name)) add(path.join(relative, name));
      }
    } else hash.update(relative).update(fs.readFileSync(absolute));
  }
  for (const file of fs.readdirSync(root).sort()) {
    if (/^(package.*\.json|.*lock.*|.*\.config\..*|app\.json|eas\.json|\.env.*|\.npmrc|\.easignore|\.gitignore)$/.test(file)) add(file);
  }
  for (const dir of ['modules', 'plugins', 'patches', 'assets/app', 'config/firebase', 'scripts']) add(dir);
  hash.update(JSON.stringify(Object.entries(process.env).filter(([key]) => key.startsWith('EXPO_PUBLIC_')).sort()));
  return hash.digest('hex');
}
try {
  const key = fingerprint();
  const marker = path.join(cache, 'active.json');
  let active;
  try { active = JSON.parse(fs.readFileSync(marker, 'utf8')); } catch { /* first build */ }
  let workspace = active && path.join(cache, active.directory, 'build');
  if (args.includes('--refresh') || active?.key !== key || !fs.existsSync(path.join(workspace || cache, '.fast-build-env.json')) || !fs.existsSync(path.join(workspace || cache, 'android/gradlew'))) {
    const directory = `workspace-${crypto.randomUUID()}`;
    workspace = path.join(cache, directory, 'build');
    console.log('Preparing a signed test build and retaining native compilation outputs…');
    run('bash', ['scripts/build-local-test.sh', ...args.filter(arg => arg !== '--refresh')], {
      env: { ...process.env, YUMYUM_FAST_BOOTSTRAP: '1', EAS_LOCAL_BUILD_SKIP_CLEANUP: '1', EAS_LOCAL_BUILD_WORKINGDIR: path.dirname(workspace) },
    });
    if (!fs.existsSync(path.join(workspace, '.fast-build-env.json'))) throw new Error('Public environment snapshot missing; cache not activated.');
    fs.writeFileSync(marker, JSON.stringify({ key, directory }), { mode: 0o600 });
    console.log('Native workspace ready. The next fast build will reuse it.');
  } else {
    console.log('Reusing signed native workspace; syncing current source files…');
    const excluded = ['builds', '.git', 'node_modules', 'android', 'ios', '.expo', 'dist', 'web-build', 'storybook-static', '.pnpm-store', 'docs', 'tests', 'stories', '.storybook', 'supabase', '.github', '.env*', 'credentials.json', 'keystore-*', '.fast-build-env.json', '*.jks', '*.keystore'];
    run('rsync', ['-a', '--delete', ...excluded.flatMap(item => ['--exclude', item]), `${root}/`, `${workspace}/`]);
    const publicEnv = JSON.parse(fs.readFileSync(path.join(workspace, '.fast-build-env.json'), 'utf8'));
    const env = { ...process.env, ...publicEnv, APP_VARIANT: 'test', EXPO_PUBLIC_APP_VARIANT: 'test', NODE_ENV: 'production', EAS_BUILD: '1', EAS_BUILD_PLATFORM: 'android', EAS_BUILD_PROFILE: 'test', EAS_BUILD_WORKINGDIR: workspace, EXPO_NO_DOTENV: '1' };
    // This is the native project generated and signed by EAS, not hand-written native configuration.
    run('./gradlew', [':app:assembleRelease', '-PreactNativeArchitectures=arm64-v8a', '--build-cache', '--console=plain'], { cwd: path.join(workspace, 'android'), env });
    const apk = path.join(workspace, 'android/app/build/outputs/apk/release/app-release.apk');
    const certificate = inspectApk(apk);
    if (fs.existsSync(output) && inspectApk(output) !== certificate) throw new Error('Signing certificate changed; existing APK preserved.');
    const temporary = `${output}.pending`;
    fs.copyFileSync(apk, temporary);
    fs.renameSync(temporary, output);
  }
  inspectApk(output);
  console.log(`Fast local build finished in ${((Date.now() - started) / 1000).toFixed(1)} seconds: ${output}`);
} finally {
  fs.rmdirSync(lock);
}
