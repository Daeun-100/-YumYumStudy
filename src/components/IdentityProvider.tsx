import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { ensureAuthIdentity, ensureIdentity } from '../lib/identity';
import { getSupabase } from '../lib/supabase';
import { toStudyError } from '../lib/contracts';
import type { Profile, StudyError, UID } from '../lib/contracts';

type IdentityState = {
  loading: boolean;
  uid: UID | null;
  profile: Profile | null;
  error: StudyError | null;
};
const IdentityContext = createContext<(IdentityState & { retry(): void }) | null>(null);

export function IdentityProvider({ children }: PropsWithChildren) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<IdentityState>({ loading: true, uid: null, profile: null, error: null });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let disposed = false;
    setState((value) => ({ ...value, loading: true, error: null }));
    async function initialize() {
      let verifiedUid: UID | null = null;
      try {
        const uid = await ensureAuthIdentity();
        verifiedUid = uid;
        if (disposed) return;
        setState({ uid, profile: null, loading: true, error: null });
        const profile = await ensureIdentity();
        if (!disposed) setState({ uid, profile, loading: false, error: null });
      } catch (failure) {
        if (!disposed) setState({ uid: verifiedUid, loading: false, profile: null, error: toStudyError(failure) });
      }
    }
    void initialize();
    return () => { disposed = true; };
  }, [attempt]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // Native refresh only while active. Supabase manages web visibility itself.
    try {
      const auth = getSupabase().auth;
      if (AppState.currentState === 'active') void auth.startAutoRefresh();
      else void auth.stopAutoRefresh();
      const subscription = AppState.addEventListener('change', (next) => {
        if (next === 'active') void auth.startAutoRefresh();
        else void auth.stopAutoRefresh();
      });
      return () => { subscription.remove(); void auth.stopAutoRefresh(); };
    } catch {
      // Configuration failures are displayed by initialization above.
    }
  }, []);

  return <IdentityContext.Provider value={{ ...state, retry }}>{children}</IdentityContext.Provider>;
}

export function useIdentity() {
  const value = useContext(IdentityContext);
  if (!value) throw new Error('IdentityProvider가 필요합니다.');
  return value;
}
