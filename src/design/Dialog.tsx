import { useUpdateReloadBlocker } from '../features/ota/useUpdateReloadBlocker';
import { Button } from './components';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentProps, type PropsWithChildren } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { spacing } from './theme';
import { useBlockingOverlay } from '../hooks/useBlockingOverlay';

const DismissContext = createContext<(() => void) | null>(null);
export function DialogCloseButton(props: Omit<ComponentProps<typeof Button>, 'onPress'>) {
  const close = useContext(DismissContext);
  return <Button {...props} onPress={() => close?.()} />;
}

type Props = PropsWithChildren<{ visible: boolean; label: string; onClose(): void; busy?: boolean; embedded?: boolean }>;
export function Dialog({ visible, label, onClose, busy = false, embedded = false, children }: Props) {
  useUpdateReloadBlocker(visible || busy);
  useBlockingOverlay(visible);
  if (!visible) return null;
  return <AnimatedDialog label={label} onClose={onClose} busy={busy} embedded={embedded}>{children}</AnimatedDialog>;
}
function AnimatedDialog({ label, onClose, busy = false, embedded = false, children }: Omit<Props, 'visible'>) {
  const [opacity] = useState(() => new Animated.Value(0));
  const closing = useRef(false);
  const open = useCallback(() => {
    Animated.timing(opacity, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [opacity]);
  useEffect(() => {
    // Embedded dialogs have no native window or onShow event.
    if (embedded) open();
    return () => { opacity.stopAnimation(); };
  }, [embedded, open, opacity]);
  const close = () => {
    if (busy || closing.current) return;
    closing.current = true;
    Animated.timing(opacity, { toValue: 0, duration: 100, useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => { if (finished) onClose(); });
  };
  const content = <Animated.View style={[s.overlay, { opacity }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} 닫기`} disabled={busy} onPress={close} style={StyleSheet.absoluteFill} />
    <View accessibilityViewIsModal role="dialog" aria-modal={true} accessibilityLabel={label} style={s.content}><DismissContext.Provider value={close}>{children}</DismissContext.Provider></View>
  </Animated.View>;
  return embedded ? <View style={StyleSheet.absoluteFill}>{content}</View> : <Modal visible transparent animationType="none" onShow={open} onRequestClose={close}>{content}</Modal>;
}
const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(37,45,40,0.36)', justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  content: { width: '100%', maxWidth: 420, maxHeight: '90%' },
});
