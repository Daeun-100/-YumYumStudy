import { getSupabase } from '../../lib/supabase';
import { roomSwitching, studyRoomId, withRoomOperation } from '../../lib/room';
import { createVersionReporter } from './report-core';
import type { VersionReport } from './report-core';

const report = createVersionReporter(async (version: VersionReport) => {
  await withRoomOperation(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const { error } = await getSupabase().rpc('report_app_version', {
        p_platform: version.platform,
        p_app_version: version.appVersion,
        p_build_version: version.buildVersion,
        p_update_id: version.updateId,
        p_runtime_version: version.runtimeVersion,
        p_embedded: version.embedded,
        p_web_build_id: version.webBuildId,
        p_app_variant: version.appVariant,
      }).abortSignal(controller.signal);
      if (error) throw error;
    } finally { clearTimeout(timeout); }
  });
});

export function reportVersion(uid: string, version: VersionReport): Promise<void> {
  if (roomSwitching) return Promise.resolve();
  return report(`${studyRoomId}:${uid}`, version);
}
