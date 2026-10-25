import 'react-native-url-polyfill/auto';
import { createClient, processLock } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { validateSupabaseConfig } from './config';
import { sessionStorage } from './session-storage';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const { url, key } = validateSupabaseConfig(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  client = createClient(url, key, {
    auth: {
      storage: sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      // Browsers retain Supabase's cross-tab navigator lock.
      ...(Platform.OS !== 'web' ? { lock: processLock } : {}),
    },
  });
  return client;
}
