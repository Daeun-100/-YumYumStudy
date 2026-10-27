export function validWebSubscription(value: unknown): value is { endpoint: string; keys: { auth: string; p256dh: string } } {
  if (!value || typeof value !== 'object') return false;
  const v = value as { endpoint?: unknown; keys?: { auth?: unknown; p256dh?: unknown } };
  if (typeof v.endpoint !== 'string' || v.endpoint.length > 4096) return false;
  try {
    const u = new URL(v.endpoint);
    // Prevent the push sender from being used as an arbitrary URL fetcher.
    if (u.protocol !== 'https:' || u.port || u.username || u.password || u.hash || !(
      u.hostname === 'web.push.apple.com' || u.hostname.endsWith('.push.apple.com') ||
      u.hostname === 'fcm.googleapis.com' || u.hostname === 'updates.push.services.mozilla.com'
    )) return false;
  } catch { return false; }
  return typeof v.keys?.auth === 'string' && /^[A-Za-z0-9_-]{22}={0,2}$/.test(v.keys.auth) &&
    typeof v.keys.p256dh === 'string' && /^[A-Za-z0-9_-]{87}={0,2}$/.test(v.keys.p256dh);
}
export function validExpoToken(value: unknown): value is string {
  return typeof value === 'string' && /^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/.test(value) && value.length < 250;
}
export function validMessage(value: unknown): value is string {
  return typeof value === 'string' && Array.from(value.trim()).length >= 1 && Array.from(value.trim()).length <= 40 && !/[\u0000-\u001f\u007f]/.test(value);
}
