import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type GuardApp = { packageName: string; label: string };
export type GuardLink = { sessionId: string; ownerId: string; roomId: number; endedAt: string | null; confirmed: boolean };
export type GuardStatus = {
  link: GuardLink | null;
  running: boolean; elapsedMs: number; reason: string; foreground: string;
  authorized: string | null; usageAccess: boolean; serviceAlive: boolean;
  notificationAccess: boolean; restrictedSettingsReviewed: boolean;
  allowed: string[]; events: { at: number; message: string }[]; pollMs: number;
};
type GuardNative = {
  status(): Promise<GuardStatus>; apps(): Promise<GuardApp[]>;
  openUsageSettings(): Promise<void>; select(packages: string[]): Promise<void>;
  openAppSettings(): Promise<void>; reviewRestrictedSettings(): Promise<void>;
  openNotificationSettings(): Promise<void>;
  setTransport(url: string, key: string, token: string, owner: string, room: number): Promise<void>;
  prepareStudy(serverNow: string): Promise<void>;
  bindStudy(id: string, owner: string, room: number, startedAt: string): Promise<void>;
  recoverStoppedStudy(id: string, owner: string, room: number, startedAt: string, serverNow: string): Promise<void>;
  acknowledgeStop(id: string): Promise<void>;
  pause(): Promise<void>; finish(): Promise<void>;
  reset(): Promise<void>; launch(packageName: string): Promise<void>;
};
export const studyGuard = Platform.OS === 'android'
  ? requireOptionalNativeModule<GuardNative>('StudyGuard') : null;
