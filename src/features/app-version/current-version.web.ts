import config from '../../../app.json';
import { isTestBuild } from '../../lib/room';
import type { VersionReport } from './report-core';

export function readCurrentVersion(): VersionReport | null {
  const commit = process.env.EXPO_PUBLIC_BUILD_SHA;
  if (__DEV__ || !commit || !/^[a-f0-9]{40}$/.test(commit)) return null;
  return {
    platform: 'web',
    appVersion: config.expo.version,
    buildVersion: null,
    updateId: null,
    runtimeVersion: null,
    embedded: null,
    webBuildId: commit,
    appVariant: isTestBuild ? 'test' : 'production',
  };
}
