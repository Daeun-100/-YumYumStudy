import { useCallback, useEffect } from 'react';
import { appActivity } from '../lib/app-activity';

export const isAppActive = appActivity.isActive;

/** Refresh on return and on web connectivity recovery, only while active.
 * Initial loads remain the caller's responsibility.
 */
export function useRefreshOnResume(refresh: () => void | Promise<void>, enabled = true) {
  const refreshIfActive = useCallback(() => {
    if (enabled && isAppActive()) void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    return appActivity.onResume(refreshIfActive);
  }, [enabled, refreshIfActive]);

  return refreshIfActive;
}
