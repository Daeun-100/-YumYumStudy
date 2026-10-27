import { useIsFocused } from 'expo-router';
import { useStudyNow } from './study-clock';

/** Screens retained by the stack do not need clock updates while covered. */
export function useScreenNow(enabled = true, resolution = 1) {
  const focused = useIsFocused();
  return useStudyNow(enabled && focused, resolution);
}
