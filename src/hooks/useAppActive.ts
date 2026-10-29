import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { isAppActive } from './useRefreshOnResume';

function subscribe(onChange: () => void) {
  if (Platform.OS === 'web') {
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }
  const subscription = AppState.addEventListener('change', onChange);
  return () => subscription.remove();
}
export function useAppActive() {
  return useSyncExternalStore(subscribe, isAppActive, () => false);
}
