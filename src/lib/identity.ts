import { createAuthBootstrap } from './identity-core';
import { getSupabase } from './supabase';
import { sessionStorage } from './session-storage';
import { ensureProfile } from '../data/profile';
import type { Profile, UID } from './contracts';

import { roomStorageKey, studyRoomId, withRoomOperation } from './room';

const bootstraps = new Map<number, ReturnType<typeof createAuthBootstrap>>();
let profileInFlight: Promise<Profile> | null = null;

export function ensureAuthIdentity(): Promise<UID> {
  // Reject configuration errors asynchronously so UI can handle them uniformly.
  return withRoomOperation(async () => {
    let bootstrap = bootstraps.get(studyRoomId);
    if (!bootstrap) {
      const rememberedUidKey = roomStorageKey('yumyumstudy.known-uid');
      bootstrap = createAuthBootstrap(getSupabase().auth, {
        read: async () => sessionStorage.getItem(rememberedUidKey),
        save: async (uid) => { await sessionStorage.setItem(rememberedUidKey, uid); },
      });
      bootstraps.set(studyRoomId, bootstrap);
    }
    return bootstrap();
  });
}

export function ensureIdentity(): Promise<Profile> {
  if (profileInFlight) return profileInFlight;
  profileInFlight = ensureAuthIdentity().then(() => ensureProfile()).finally(() => { profileInFlight = null; });
  return profileInFlight;
}
