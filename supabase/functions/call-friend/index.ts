import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
import { validExpoToken, validMessage, validWebSubscription } from './validation.ts';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Content-Type': 'application/json' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Device = { id: string; provider: 'expo' | 'web'; address: unknown };
async function deliver(device: Device, call: { id: string; title: string; message: string; room_id: number }) {
  try {
    if (device.provider === 'expo') {
      if (!validExpoToken(device.address)) return { accepted: false, invalid: true };
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST', signal: AbortSignal.timeout(12000),
        headers: { 'Content-Type': 'application/json', ...(Deno.env.get('EXPO_ACCESS_TOKEN') ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` } : {}) },
        body: JSON.stringify({ to: device.address, title: call.title, body: call.message, sound: 'default', priority: 'high', channelId: 'friend-calls', ttl: 300, data: { type: 'friend-call', callId: call.id, roomId: call.room_id } }),
      });
      if (!res.ok) return { accepted: false, unknown: res.status >= 500 };
      const { data } = await res.json();
      return { ticketId: data?.status === 'ok' ? data.id as string : undefined, accepted: data?.status === 'ok', invalid: data?.details?.error === 'DeviceNotRegistered' };
    }
    if (!validWebSubscription(device.address)) return { accepted: false, invalid: true };
    const publicKey = Deno.env.get('WEB_PUSH_PUBLIC_KEY');
    const privateKey = Deno.env.get('WEB_PUSH_PRIVATE_KEY');
    if (!publicKey || !privateKey) return { accepted: false };
    await webpush.sendNotification(device.address, JSON.stringify({ title: call.title, body: call.message, callId: call.id, roomId: call.room_id }), {
      TTL: 300, urgency: 'high', timeout: 12000,
      vapidDetails: { subject: `https://${new URL(url).hostname}`, publicKey, privateKey },
    });
    return { accepted: true };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return { accepted: false, invalid: status === 404 || status === 410, unknown: !status || status >= 500 };
  }
}

async function checkReceipts(callId: string, recipient: string) {
  const { data: rows } = await admin.from('friend_call_receipts').select('ticket_id,device_id').eq('call_id', callId).is('checked_at', null);
  if (!rows?.length) return;
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST', signal: AbortSignal.timeout(12000),
      headers: { 'Content-Type': 'application/json', ...(Deno.env.get('EXPO_ACCESS_TOKEN') ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` } : {}) },
      body: JSON.stringify({ ids: rows.map(row => row.ticket_id) }),
    });
    if (!response.ok) return;
    const { data } = await response.json();
    for (const row of rows) {
      const receipt = data?.[row.ticket_id];
      if (!receipt) continue;
      const code = receipt.details?.error ?? null;
      await admin.from('friend_call_receipts').update({ checked_at: new Date().toISOString(), error_code: code }).eq('ticket_id', row.ticket_id);
      if (code === 'DeviceNotRegistered') await admin.from('friend_call_devices').update({ enabled: false }).eq('id', row.device_id).eq('user_id', recipient);
    }
  } catch { /* An unknown receipt is retained for the next status check. */ }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer /i, '');
    if (!token) return reply({ error: '로그인이 필요해요.' }, 401);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return reply({ error: '로그인을 다시 확인해 주세요.' }, 401);
    const body = await req.text();
    if (body.length > 12000) return reply({ error: '요청이 너무 커요.' }, 400);
    const input = JSON.parse(body);
    const { data: profile } = await admin.from('profiles').select('room_id,invite_verified_at,name_confirmed').eq('id', user.id).single();
    if (!profile?.invite_verified_at || !profile.name_confirmed || input.roomId !== profile.room_id) return reply({ error: '방 입장 정보를 확인해 주세요.' }, 403);
    if (input.action === 'config') return reply({ publicKey: Deno.env.get('WEB_PUSH_PUBLIC_KEY') ?? null });
    if (input.action === 'register') {
      const valid = input.provider === 'expo' ? validExpoToken(input.address) : input.provider === 'web' && validWebSubscription(input.address);
      if (!valid) return reply({ error: '알림 기기 정보가 올바르지 않아요.' }, 400);
      const destination = input.provider === 'expo' ? input.address : input.address.endpoint;
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(destination));
      const id = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      const { error } = await admin.rpc('register_friend_call_device', { p_user: user.id, p_room: profile.room_id, p_id: id, p_provider: input.provider, p_address: input.address });
      if (error) return reply({ error: error.code === '22023' ? error.message : '알림 기기를 등록하지 못했어요.' }, 400);
      return reply({ deviceId: id });
    }
    if (input.action === 'status') {
      const { data } = await admin.from('friend_call_devices').select('enabled').eq('id', String(input.deviceId)).eq('user_id', user.id).maybeSingle();
      return reply({ enabled: data?.enabled === true });
    }
    if (input.action === 'disable') {
      if (typeof input.deviceId !== 'string') return reply({ error: '기기 정보가 없어요.' }, 400);
      const { error } = await admin.from('friend_call_devices').update({ enabled: false }).eq('id', input.deviceId).eq('user_id', user.id);
      if (error) return reply({ error: '알림 해제를 처리하지 못했어요.' }, 500);
      return reply({ disabled: true });
    }
    if (input.action !== 'send' || !uuid.test(input.id) || !uuid.test(input.recipientId) || !validMessage(input.message)) return reply({ error: '메시지를 1~40자로 입력해 주세요.' }, 400);
    const { data: reservation, error } = await admin.rpc('reserve_friend_call', { p_sender: user.id, p_room: profile.room_id, p_recipient: input.recipientId, p_id: input.id, p_message: input.message.trim() });
    if (error) return reply({ error: ['22023', '42501'].includes(error.code) ? error.message : '친구를 부르지 못했어요.' }, 400);
    const call = reservation.call;
    if (!reservation.dispatch) {
      await checkReceipts(call.id, call.recipient_id);
      return reply({ id: call.id, status: call.status, acceptedCount: call.accepted_count });
    }
    const { data: devices, error: deviceError } = await admin.from('friend_call_devices').select('id,provider,address').eq('user_id', call.recipient_id).eq('enabled', true).limit(5);
    if (deviceError) throw new Error('Device lookup failed');
    const results = await Promise.all((devices ?? []).map(async (device: Device) => {
      const result = await deliver(device, call);
      if ('ticketId' in result && result.ticketId) await admin.from('friend_call_receipts').insert({ ticket_id: result.ticketId, call_id: call.id, device_id: device.id });
      if (result.invalid) await admin.from('friend_call_devices').update({ enabled: false }).eq('id', device.id).eq('user_id', call.recipient_id);
      return result;
    }));
    const acceptedCount = results.filter(r => r.accepted).length;
    const status = acceptedCount ? 'accepted' : results.some(r => r.unknown) ? 'unknown' : 'failed';
    const { error: updateError } = await admin.from('friend_calls').update({ status, accepted_count: acceptedCount }).eq('id', call.id);
    if (updateError) return reply({ id: call.id, status: 'unknown', acceptedCount });
    if (acceptedCount && typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil((async () => {
      await new Promise(resolve => setTimeout(resolve, 15000));
      await checkReceipts(call.id, call.recipient_id);
    })());
    return reply({ id: call.id, status, acceptedCount });
  } catch {
    // Never log auth tokens, subscriptions, credentials or message contents.
    return reply({ error: '알림 요청 결과를 확인하지 못했어요. 같은 요청으로 다시 확인해 주세요.' }, 500);
  }
});
