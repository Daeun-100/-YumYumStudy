import { AppState, Platform } from 'react-native';
import { createAppActivity } from './app-activity-core';

export const appActivity = createAppActivity(Platform.OS === 'web' ? {
  kind: 'web',
  document: () => typeof document === 'undefined' ? undefined : document,
  window: () => typeof window === 'undefined' ? undefined : window,
} : {
  kind: 'native',
  currentState: () => AppState.currentState,
  subscribe: callback => {
    const subscription = AppState.addEventListener('change', callback);
    return () => subscription.remove();
  },
});
