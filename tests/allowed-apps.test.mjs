import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Exercise the exact policy used by the Android service, rather than a JS copy.
test('Android timer policy: launch provenance, app switching, manual resume, timeout and departure', () => {
  const dir = mkdtempSync(join(tmpdir(), 'study-guard-test-'));
  const javaHome = process.env.JAVA_HOME || '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home';
  try {
    execFileSync(join(javaHome, 'bin/javac'), ['-d', dir,
      'modules/study-guard/android/src/main/java/expo/modules/studyguard/GuardSession.java',
      'tests/native/GuardSessionTest.java']);
    execFileSync(join(javaHome, 'bin/java'), ['-cp', dir, 'GuardSessionTest']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
