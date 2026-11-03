// Metro selects monotonic.web.ts in browsers. Both adapters return milliseconds.
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
const nativeClock = Platform.OS === 'android'
  ? requireOptionalNativeModule<{ monotonicNow?(): number }>('StudyGuard') : null;
// Native elapsedRealtime spans device sleep.
export const refreshClockOnResume = false;
export const monotonicNow = () => nativeClock?.monotonicNow?.() ?? performance.now();
