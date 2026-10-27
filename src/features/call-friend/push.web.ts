import { callService } from './api';
import { roomStorageKey, studyRoomId } from '../../lib/room';
import { sessionStorage } from '../../lib/session-storage';

function supported() {
  return typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
function installedIPhone() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return !ios || window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
}
let worker: Promise<ServiceWorkerRegistration> | null = null;
export async function preparePush() {
  if (supported() && !worker) worker = navigator.serviceWorker.register('/call-worker.js', { scope: '/' }).catch(e => { worker = null; throw e; });
  await worker;
}
export async function enablePush(ask = true): Promise<void> {
  if (!supported() || !installedIPhone()) throw new Error('iPhone은 Safari에서 공유 → 홈 화면에 추가 후 앱을 열어 주세요. 알림은 HTTPS에서 사용할 수 있어요.');
  // Invoke immediately from a button tap, before any network or worker awaits (iOS).
  const permission = ask ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') throw new Error('기기 설정에서 얌얌스터디 알림을 허용해 주세요.');
  await preparePush();
  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await callService<{ publicKey: string | null }>({ action: 'config' });
  if (!publicKey) throw new Error('서버의 웹 알림 설정이 아직 준비되지 않았어요.');
  const base64 = publicKey.replace(/-/g, '+').replace(/_/g, '/');
  const key = Uint8Array.from(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)), c => c.charCodeAt(0));
  const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const { deviceId } = await callService<{ deviceId: string }>({ action: 'register', provider: 'web', address: subscription.toJSON() });
  await sessionStorage.setItem(roomStorageKey('friend-call-device'), deviceId);
  await sessionStorage.setItem('friend-call-opt-in', 'true');
}
export async function refreshPush(): Promise<void> {
  if (await sessionStorage.getItem('friend-call-opt-in') === 'true') await enablePush(false);
}
export async function pushEnabled(): Promise<boolean> {
  if (!supported() || Notification.permission !== 'granted') return false;
  const deviceId = await sessionStorage.getItem(roomStorageKey('friend-call-device'));
  if (!deviceId) return false;
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!await registration?.pushManager.getSubscription()) return false;
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
  const query = new URL(window.location.href).searchParams.get('friendCallRoom');
  if (query !== null) {
    window.history.replaceState(null, '', window.location.pathname);
    if (Number(query) === studyRoomId) onOpen();
    else window.alert('다른 방에서 온 부르기 알림이에요. 해당 방으로 전환해 주세요.');
  }
  return () => {};
}
