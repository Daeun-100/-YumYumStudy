import { createAuthBootstrap } from './identity-core';
import { getSupabase } from './supabase';
import { sessionStorage } from './session-storage';
import { ensureProfile } from '../data/profile';
import type { Profile, UID } from './contracts';

const rememberedUidKey = 'yumyumstudy.known-uid';
let bootstrap: ReturnType<typeof createAuthBootstrap> | null = null;
let profileInFlight: Promise<Profile> | null = null;

export function ensureAuthIdentity(): Promise<UID> {
  // Reject configuration errors asynchronously so UI can handle them uniformly.
  return Promise.resolve().then(() => {
    if (!bootstrap) {
      bootstrap = createAuthBootstrap(getSupabase().auth, {
        read: async () => sessionStorage.getItem(rememberedUidKey),
        save: async (uid) => { await sessionStorage.setItem(rememberedUidKey, uid); },
      });
    }
    return bootstrap();
  });
}

export function ensureIdentity(): Promise<Profile> {
  if (profileInFlight) return profileInFlight;
  profileInFlight = ensureAuthIdentity().then(() => ensureProfile()).finally(() => { profileInFlight = null; });
  return profileInFlight;
}
