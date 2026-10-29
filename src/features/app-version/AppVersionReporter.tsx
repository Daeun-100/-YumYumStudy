import { useCallback, useEffect } from 'react';
import { useIdentity } from '../../components/IdentityProvider';
import { isAppActive, useRefreshOnResume } from '../../hooks/useRefreshOnResume';
import { readCurrentVersion } from './current-version';
import { reportVersion } from './report-version';

/** Best effort diagnostics: never block admission or show errors to the user. */
export function AppVersionReporter() {
  const { uid, profile, step, loading, error } = useIdentity();
  const enabled = !!uid && !!profile && step === 'ready' && !loading && !error;
  const refresh = useCallback(async () => {
    if (!enabled || !uid || !isAppActive()) return;
    try {
      const version = await readCurrentVersion();
      if (version) await reportVersion(uid, version);
    } catch {
      // Retry on the next foreground/online event; failed reports aren't cached.
    }
  }, [enabled, uid]);
  useRefreshOnResume(refresh, enabled);
  useEffect(() => { void refresh(); }, [refresh]);
  return null;
}
