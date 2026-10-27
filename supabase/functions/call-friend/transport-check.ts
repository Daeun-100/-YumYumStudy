import webpush from 'web-push';
import { createECDH, randomBytes } from 'node:crypto';
const settings = Object.fromEntries((await Deno.readTextFile('builds/push-secrets/web-push.env')).trim().split('\n').map(line => line.split('=')));
const client = createECDH('prime256v1'); client.generateKeys();
const sub = { endpoint: 'https://web.push.apple.com/test-encryption-only', keys: { p256dh: client.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } };
const request = webpush.generateRequestDetails(sub, JSON.stringify({ title: '친구님이 불렀어요!', body: '같이 공부하자! 🍀', roomId: 0 }), {
  TTL: 300,
  vapidDetails: { subject: 'https://hxwwhgxxvyzqqnxlgqde.supabase.co', publicKey: settings.WEB_PUSH_PUBLIC_KEY, privateKey: settings.WEB_PUSH_PRIVATE_KEY },
});
if (!request.body || request.headers['Content-Encoding'] !== 'aes128gcm' || !request.headers.Authorization) throw new Error('Web Push encryption failed');
console.log('PASS: Deno runtime generated encrypted iPhone Web Push payload and VAPID authentication; no network request sent');
