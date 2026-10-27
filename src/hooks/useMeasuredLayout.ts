import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createLayoutCache } from '../lib/layout-cache';
import { sessionStorage } from '../lib/session-storage';

const cache = createLayoutCache(sessionStorage);
// Restore early; fresh measurements always win over an older stored value.
void cache.hydrate();
export function useMeasuredLayout(slot: string, variant = '') {
  const { width, height, scale, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const key = JSON.stringify([slot, Platform.OS, width, height, scale, fontScale, insets.top, insets.bottom, insets.left, insets.right, variant]);
  const read = useCallback(() => cache.read(key), [key]);
  const measured = useSyncExternalStore(cache.subscribe, read, read);
  // A new viewport/variant key may have no cached measurement yet (e.g. the
  // iPhone keyboard opening). Keep this slot mounted while onLayout catches up.
  // Retain in React state so interrupted renders cannot overwrite the fallback.
  const [previous, setPrevious] = useState({ slot, size: measured });
  if (previous.slot !== slot || (measured !== null && previous.size !== measured)) {
    setPrevious({ slot, size: measured });
  }
  const size = measured ?? (previous.slot === slot ? previous.size : null);
  useEffect(() => { void cache.hydrate(); }, []);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    cache.measure(key, { width, height });
  }, [key]);
  return { size, onLayout };
}
