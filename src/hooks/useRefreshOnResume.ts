import { useCallback, useEffect } from 'react';
import { AppState, Platform } from 'react-native';

// Also shared by polling and realtime callbacks: hidden screens do not fetch.
export function isAppActive(): boolean {
  return Platform.OS === 'web'
    ? typeof document !== 'undefined' && document.visibilityState === 'visible'
    : AppState.currentState === 'active';
}

/** Refresh on return and on web connectivity recovery, only while active.
 * Initial loads remain the caller's responsibility.
 */
export function useRefreshOnResume(refresh: () => void | Promise<void>, enabled = true) {
  const refreshIfActive = useCallback(() => {
    if (enabled && isAppActive()) void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined' || typeof window === 'undefined') return;
      document.addEventListener('visibilitychange', refreshIfActive);
      window.addEventListener('online', refreshIfActive);
      return () => {
        document.removeEventListener('visibilitychange', refreshIfActive);
        window.removeEventListener('online', refreshIfActive);
      };
    }
    const subscription = AppState.addEventListener('change', refreshIfActive);
    return () => subscription.remove();
  }, [enabled, refreshIfActive]);

  return refreshIfActive;
}
