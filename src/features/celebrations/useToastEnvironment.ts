import { useEffect, useState } from 'react';
import { AccessibilityInfo, Keyboard, Platform } from 'react-native';
import { useAppActive } from '../../hooks/useAppActive';
import { useOverlaysBlocked } from '../../hooks/useBlockingOverlay';

export function useToastEnvironment() {
  const active = useAppActive();
  const modal = useOverlaysBlocked();
  const [keyboard, setKeyboard] = useState(() => Platform.OS !== 'web' && Keyboard.isVisible());
  const [accessibility, setAccessibility] = useState({ ready: false, reducedMotion: false, screenReader: false });
  useEffect(() => {
    let alive = true;
    void Promise.all([AccessibilityInfo.isReduceMotionEnabled(), AccessibilityInfo.isScreenReaderEnabled()]).then(([reducedMotion, screenReader]) => {
      if (alive) setAccessibility({ ready: true, reducedMotion, screenReader });
    }).catch(() => { if (alive) setAccessibility({ ready: true, reducedMotion: true, screenReader: false }); });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', reducedMotion => setAccessibility(s => ({ ...s, reducedMotion })));
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', screenReader => setAccessibility(s => ({ ...s, screenReader })));
    return () => { alive = false; motion.remove(); reader.remove(); };
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const check = () => {
        const element = document.activeElement as HTMLElement | null;
        setKeyboard(!!element && (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable));
      };
      check();
      document.addEventListener('focusin', check); document.addEventListener('focusout', check);
      return () => { document.removeEventListener('focusin', check); document.removeEventListener('focusout', check); };
    }
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return { ...accessibility, active, blocked: modal || keyboard };
}
