import { withTimeout } from '../lib/with-timeout';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { ensureAuthIdentity, ensureIdentity } from '../lib/identity';
import { getSupabase } from '../lib/supabase';
import { toStudyError } from '../lib/contracts';
import type { Profile, StudyError, UID } from '../lib/contracts';
import { getOnboarding } from '../data/onboarding';
import type { Onboarding } from '../lib/onboarding';

type IdentityState = {
  loading: boolean;
  step: Onboarding['step'] | null;
  uid: UID | null;
  profile: Profile | null;
  error: StudyError | null;
};
const IdentityContext = createContext<(IdentityState & { retry(): void; updateProfile(profile: Profile): void }) | null>(null);

export function IdentityProvider({ children }: PropsWithChildren) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<IdentityState>({ loading: true, uid: null, profile: null, step: null, error: null });
  const retry = useCallback(() => {
    setState((value) => ({ ...value, loading: true, error: null }));
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let disposed = false;
    async function initialize() {
      let verifiedUid: UID | null = null;
      try {
        const uid = await withTimeout(ensureAuthIdentity(), 15000, '로그인 확인이 지연되고 있어요. 인터넷 연결을 확인한 뒤 다시 확인을 눌러 주세요.');
        verifiedUid = uid;
        if (disposed) return;
        setState({ uid, profile: null, step: null, loading: true, error: null });
        const admission = await withTimeout(getOnboarding(), 15000, '입장 상태를 불러오지 못했어요. 다시 확인해 주세요.');
        if (disposed) return;
        if (admission.step !== 'ready') {
          setState({ uid, profile: null, step: admission.step, loading: false, error: null });
          return;
        }
        const profile = await withTimeout(ensureIdentity(), 15000, '내 정보를 불러오지 못했어요. 다시 확인해 주세요.');
        if (disposed) return;
        if (!disposed) setState({ uid, profile, step: 'ready', loading: false, error: null });
      } catch (failure) {
        if (!disposed) setState({ uid: verifiedUid, loading: false, profile: null, step: null, error: toStudyError(failure) });
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

  return <IdentityContext.Provider value={{ ...state, retry, updateProfile: profile => setState(value => ({ ...value, profile })) }}>{children}</IdentityContext.Provider>;
}

export function useIdentity() {
  const value = useContext(IdentityContext);
  if (!value) throw new Error('IdentityProvider가 필요합니다.');
  return value;
}
