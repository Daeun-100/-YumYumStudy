import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import { isTestBuild } from '../../lib/room';
import type { VersionReport } from './report-core';

export async function readCurrentVersion(): Promise<VersionReport | null> {
  if (__DEV__ || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return null;
  // A missing module in an older binary must not prevent the app from starting.
  const Application = await import('expo-application');
  // Never substitute OTA app config for the version of the installed binary.
  if (!Application.nativeApplicationVersion || !Application.nativeBuildVersion) return null;
  return {
    platform: Platform.OS,
    appVersion: Application.nativeApplicationVersion,
    buildVersion: Application.nativeBuildVersion,
    updateId: Updates.isEnabled ? Updates.updateId : null,
    runtimeVersion: Updates.isEnabled ? Updates.runtimeVersion : null,
    embedded: Updates.isEnabled ? Updates.isEmbeddedLaunch : null,
    webBuildId: null,
    appVariant: isTestBuild ? 'test' : 'production',
  };
}
