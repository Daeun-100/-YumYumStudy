import 'react-native-url-polyfill/auto';
import { createClient, processLock } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { validateSupabaseConfig } from './config';
import { sessionStorage } from './session-storage';
import { isTestRoom, studyRoomId } from './room';
import { createNetworkFetch } from './network-fetch';

const clients = new Map<number, SupabaseClient>();

export function getSupabase(): SupabaseClient {
  const existing = clients.get(studyRoomId);
  if (existing) return existing;
  const { url, key } = validateSupabaseConfig(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const client = createClient(url, key, {
    global: { fetch: createNetworkFetch(fetch) },
    auth: {
      storage: sessionStorage,
      ...(isTestRoom ? { storageKey: `sb-${new URL(url).hostname.split('.')[0]}-auth-token-test-room-0` } : {}),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      // Browsers retain Supabase's cross-tab navigator lock.
      ...(Platform.OS !== 'web' ? { lock: processLock } : {}),
    },
  });
  clients.set(studyRoomId, client);
  return client;
}
