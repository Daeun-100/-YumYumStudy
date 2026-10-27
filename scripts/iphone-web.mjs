import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export function parseOptions(args) {
  const options = { port: 8081, device: null, help: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--help') options.help = true;
    else if (arg === '--port' && /^\d+$/.test(args[index + 1] ?? '')) options.port = Number(args[++index]);
    else if (arg === '--device' && args[index + 1]) options.device = args[++index];
    else throw Error(`알 수 없거나 값이 없는 옵션: ${arg}`);
  }
  if (options.port < 1 || options.port > 65535) throw Error('포트는 1~65535 사이여야 합니다.');
  return options;
}

export function selectIphone(devices, requested) {
  const iphones = Object.values(devices).flat().filter(device => device.isAvailable && device.name.startsWith('iPhone'));
  if (requested) {
    const matches = iphones.filter(device => device.udid === requested || device.name === requested);
    if (matches.length !== 1) throw Error('해당 iPhone을 하나로 특정할 수 없습니다. simctl 목록의 UDID를 --device에 지정하세요.');
    return matches[0];
  }
  const selected = iphones.find(device => device.state === 'Booted') ?? iphones[0];
  if (!selected) throw Error('사용 가능한 iPhone이 없습니다. Xcode Settings → Components에서 iOS 런타임을 설치하세요.');
  return selected;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    console.log('npm run web:iphone -- [--port 8081] [--device "iPhone 이름 또는 UDID"]\n웹 개발 서버와 iPhone Safari를 실행합니다. 기본값은 테스트 변형이며 네이티브 빌드는 하지 않습니다.');
    return;
  }
  if (process.platform !== 'darwin') throw Error('iPhone 시뮬레이터는 macOS에서 실행하세요.');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const selectedPath = execFileSync('xcode-select', ['-p'], { encoding: 'utf8' }).trim();
  const developer = process.env.DEVELOPER_DIR ?? (existsSync(`${selectedPath}/Applications/Simulator.app`)
    ? selectedPath : '/Applications/Xcode.app/Contents/Developer');
  if (!existsSync(`${developer}/Applications/Simulator.app`)) throw Error('Xcode를 설치하거나 DEVELOPER_DIR에 Xcode Developer 경로를 지정하세요.');
  const variant = process.env.APP_VARIANT ?? process.env.EXPO_PUBLIC_APP_VARIANT ?? 'test';
  const env = { ...process.env, DEVELOPER_DIR: developer, APP_VARIANT: variant, EXPO_PUBLIC_APP_VARIANT: variant, BROWSER: 'none' };
  const run = (command, args) => new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(Error(`${command} 실행 실패 (${code})`)));
  });
  const devices = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], { env, encoding: 'utf8' })).devices;
  const device = selectIphone(devices, options.device);
  // Do not open another project's server when the requested port is occupied.
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () => reject(Error(`${options.port} 포트가 사용 중입니다. --port로 다른 포트를 지정하세요.`)));
    probe.listen(options.port, '127.0.0.1', () => probe.close(resolve));
  });
  const require = createRequire(import.meta.url);
  const server = spawn(process.execPath, [require.resolve('expo/bin/cli'), 'start', '--web', '--localhost', '--port', String(options.port)], { env, cwd: root, stdio: 'inherit' });
  let serverError;
  server.on('error', error => { serverError = error; });
  const serverClosed = new Promise(resolve => server.on('exit', code => resolve(code)));
  const stop = () => { if (server.exitCode === null) server.kill('SIGTERM'); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    console.log(`\niPhone 웹 테스트: ${device.name} · ${variant} · http://localhost:${options.port}\n`);
    if (device.state !== 'Booted') await run('xcrun', ['simctl', 'boot', device.udid]);
    await run('xcrun', ['simctl', 'bootstatus', device.udid, '-b']);
    await run('open', ['-a', `${developer}/Applications/Simulator.app`, '--args', '-CurrentDeviceUDID', device.udid]);
    const deadline = Date.now() + 120000;
    while (true) {
      if (serverError) throw serverError;
      if (server.exitCode !== null || server.signalCode !== null) throw Error('웹 개발 서버가 종료됐습니다. 위 로그를 확인하세요.');
      try {
        const response = await fetch(`http://localhost:${options.port}/status`, { signal: AbortSignal.timeout(1500) });
        if ((await response.text()).includes('packager-status:running')) break;
      } catch { /* Metro may still be starting. */ }
      if (Date.now() > deadline) throw Error('웹 서버 준비 시간이 초과됐습니다. 위 Metro 로그를 확인하세요.');
      await delay(500);
    }
    await run('xcrun', ['simctl', 'openurl', device.udid, `http://localhost:${options.port}`]);
    console.log('\nSafari에서 확인하세요. 코드 저장 시 Fast Refresh가 적용됩니다. 종료: Ctrl+C\n');
    process.exitCode = (await serverClosed) ?? 0;
  } finally {
    stop();
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
