import { AndroidImportance } from 'expo-notifications';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { callService } from './api';
import { roomStorageKey, studyRoomId } from '../../lib/room';
import { sessionStorage } from '../../lib/session-storage';

Notifications.setNotificationHandler({ handleNotification: async notification => ({
  shouldShowBanner: notification.request.content.data?.roomId === studyRoomId,
  shouldShowList: notification.request.content.data?.roomId === studyRoomId,
  shouldPlaySound: notification.request.content.data?.roomId === studyRoomId,
  shouldSetBadge: false,
}) });
export async function preparePush() { /* Native permissions are requested only by the settings button. */ }
export async function enablePush(ask = true): Promise<void> {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('friend-calls', {
    name: '친구 부르기', importance: AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 200, 100, 200],
  });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && ask) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('휴대폰 설정에서 얌얌스터디 알림을 허용해 주세요.');
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error('앱의 알림 설정을 확인해 주세요.');
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const { deviceId } = await callService<{ deviceId: string }>({ action: 'register', provider: 'expo', address: token.data });
  await sessionStorage.setItem(roomStorageKey('friend-call-device'), deviceId);
  await sessionStorage.setItem('friend-call-opt-in', 'true');
}
export async function refreshPush(): Promise<void> {
  if (await sessionStorage.getItem('friend-call-opt-in') === 'true') await enablePush(false);
}
export async function pushEnabled(): Promise<boolean> {
  if (!(await Notifications.getPermissionsAsync()).granted) return false;
  const deviceId = await sessionStorage.getItem(roomStorageKey('friend-call-device'));
  if (!deviceId) return false;
  return (await callService<{ enabled: boolean }>({ action: 'status', deviceId })).enabled;
}
export async function disablePush(): Promise<void> {
  const key = roomStorageKey('friend-call-device');
  const deviceId = await sessionStorage.getItem(key);
  if (deviceId) await callService({ action: 'disable', deviceId });
  await sessionStorage.removeItem(key);
  await sessionStorage.setItem('friend-call-opt-in', 'false');
}
export function listenForCalls(onOpen: () => void): () => void {
  const open = (response: Notifications.NotificationResponse | null) => {
    const data = response?.notification.request.content.data;
    if (data?.type === 'friend-call' && data.roomId === studyRoomId) {
      onOpen(); void Notifications.clearLastNotificationResponseAsync();
    }
  };
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  const tokenSub = Notifications.addPushTokenListener(() => { void refreshPush().catch(() => {}); });
  void Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
  return () => { sub.remove(); tokenSub.remove(); };
}
