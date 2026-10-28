import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';

// Only the visible screen owns the Android system back action.
export function useAndroidBack(onBack: () => boolean) {
  const latest = useRef(onBack);
  useEffect(() => { latest.current = onBack; }, [onBack]);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => latest.current());
    return () => subscription.remove();
  }, []));
}
