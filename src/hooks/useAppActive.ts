import { useSyncExternalStore } from 'react';
import { appActivity } from '../lib/app-activity';

export function useAppActive() {
  return useSyncExternalStore(appActivity.subscribe, appActivity.isActive, () => false);
}
