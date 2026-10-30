import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { useIdentity } from '../../components/IdentityProvider';
import { isAppActive, useRefreshOnResume } from '../../hooks/useRefreshOnResume';
import { getSupabase } from '../../lib/supabase';
import { withRoomOperation } from '../../lib/room';
import { withTimeout } from '../../lib/with-timeout';
import { studyGuard } from '../allowed-apps/native';
import { readCurrentVersion } from '../app-version/current-version';
import { createExitReporter } from './report-core';

// Optional methods keep older APKs and web compatible with the same JS bundle.
const report = studyGuard?.pendingDiagnostics && studyGuard?.acknowledgeDiagnostics ? createExitReporter({
  pending: () => withTimeout(studyGuard!.pendingDiagnostics!(), 5000, '진단 조회 지연'),
  acknowledge: ids => withTimeout(studyGuard!.acknowledgeDiagnostics!(ids), 5000, '진단 저장 지연'),
  send: async event => {
    const version = await readCurrentVersion();
    if (!version) throw new Error('Native version unavailable');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const { error } = await getSupabase().rpc('report_android_exit', {
        p_event: event, p_version: version.appVersion, p_build: version.buildVersion, p_update_id: version.updateId,
      }).abortSignal(controller.signal);
      if (error) throw error;
    } finally { clearTimeout(timeout); }
  },
}) : null;

/** Never gates startup. A failed/offline upload stays on-device for the next foreground retry. */
export function ExitDiagnosticsReporter() {
  const { uid, profile, step, loading, error } = useIdentity();
  const enabled = Platform.OS === 'android' && !!uid && !!profile && step === 'ready' && !loading && !error;
  const refresh = useCallback(async () => {
    if (!enabled || !report || !isAppActive()) return;
    try { await withRoomOperation(report); } catch { /* Keep native outbox, retry later. */ }
  }, [enabled]);
  useRefreshOnResume(refresh, enabled);
  useEffect(() => {
    void refresh();
    if (!enabled) return;
    const timer = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(timer);
  }, [enabled, refresh]);
  return null;
}
