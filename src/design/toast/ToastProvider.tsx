import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type PropsWithChildren, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { Bell, Check, Gift } from 'lucide-react-native';
import { colors, layout, typography } from '../theme';
import { createToastStore, TOAST_EXIT_MS, type ToastDismissReason, type ToastEntry, type ToastOptions } from './store';
import { useToastEnvironment as useDeviceEnvironment } from './useToastEnvironment';

type Environment = ReturnType<typeof useDeviceEnvironment>;
type ToastApi = {
  show(options: ToastOptions): string | null;
  update(id: string, patch: Partial<ToastOptions>): boolean;
  dismiss(id: string): void;
  clear(): void;
};
const Context = createContext<(ToastApi & { environment: Environment }) | null>(null);
export function useToast() {
  const value = useContext(Context);
  if (!value) throw new Error('ToastProvider required');
  return value;
}
export function useToastEnvironment() { return useToast().environment; }

function MessageToast({ entry, environment }: { entry: ToastEntry; environment: Environment }) {
  const [entrance] = useState(() => new Animated.Value(environment.reducedMotion ? 1 : 0));
  useEffect(() => {
    const animation = Animated.timing(entrance, { toValue: entry.closing ? 0 : 1, duration: environment.reducedMotion ? 0 : entry.closing ? TOAST_EXIT_MS : 240, easing: entry.closing ? Easing.in(Easing.cubic) : Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start(); return () => animation.stop();
  }, [entrance, environment.reducedMotion, entry.closing]);
  useEffect(() => {
    if (environment.screenReader && Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility([entry.title, entry.message].filter(Boolean).join('. '));
  }, [entry.title, entry.message, environment.screenReader]);
  const tone = entry.tone ?? 'info', Icon = tone === 'success' ? Check : tone === 'reward' ? Gift : Bell;
  const color = tone === 'success' ? colors.primary : tone === 'reward' ? colors.leave : colors.secondary;
  return <Animated.View testID="common-toast" accessibilityLiveRegion="polite" style={[s.card, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}>
    {entry.showIcon !== false && <View accessible={false} accessibilityElementsHidden style={[s.icon, { backgroundColor: tone === 'reward' ? colors.leaveBackground : colors.soft }]}><Icon size={21} color={color} strokeWidth={1.8} /></View>}
    <View style={s.copy}>{!!entry.title?.trim() && <Text accessibilityRole="header" style={s.title}>{entry.title}</Text>}{!!entry.message?.trim() && <Text style={s.message}>{entry.message}</Text>}</View>
  </Animated.View>;
}
function ActiveToast({ entry, store, scope, environment, dismiss }: { entry: ToastEntry; store: ReturnType<typeof createToastStore>; scope: string; environment: Environment; dismiss(): void }) {
  useLayoutEffect(() => { store.didPresent(entry.id, scope); }, [store, entry.id, scope]);
  return entry.render ? entry.render({ dismiss, reducedMotion: environment.reducedMotion, screenReader: environment.screenReader }) : <MessageToast entry={entry} environment={environment} />;
}
export function ToastProvider({ children, scope, enabled = true }: PropsWithChildren<{ scope: string; enabled?: boolean }>) {
  const device = useDeviceEnvironment();
  const environment = useMemo(() => ({ ready: enabled && device.ready, active: device.active, blocked: device.blocked, reducedMotion: device.reducedMotion, screenReader: device.screenReader }), [enabled, device.ready, device.active, device.blocked, device.reducedMotion, device.screenReader]);
  const [store] = useState(() => {
    const value = createToastStore(); value.setScope(scope);
    value.setEnvironment({ enabled, active: environment.active, blocked: !environment.ready || environment.blocked, screenReader: environment.screenReader, reducedMotion: environment.reducedMotion });
    return value;
  });
  const snapshot = useSyncExternalStore(store.subscribe, store.read, store.read);
  const binding = useMemo(() => ({ scope }), [scope]);
  const currentBinding = useRef(binding);
  useLayoutEffect(() => { currentBinding.current = binding; store.setScope(scope); }, [store, scope, binding]);
  useLayoutEffect(() => {
    store.setEnvironment({ enabled, active: environment.active, blocked: !environment.ready || environment.blocked, screenReader: environment.screenReader, reducedMotion: environment.reducedMotion });
  }, [store, enabled, environment]);
  useEffect(() => () => store.dispose(), [store]);
  const api = useMemo<ToastApi>(() => ({
    show: options => currentBinding.current === binding ? store.show(options, scope) : null,
    update: (id, patch) => currentBinding.current === binding && store.update(id, patch, scope),
    dismiss: id => { if (currentBinding.current === binding) store.dismiss(id, scope); },
    clear: () => { if (currentBinding.current === binding) store.clear(scope); },
  }), [store, scope, binding]);
  const context = useMemo(() => ({ ...api, environment }), [api, environment]);
  const visible = snapshot.scope === scope && environment.ready && environment.active && !environment.blocked ? snapshot.active : null;
  return <Context.Provider value={context}><View style={s.root}>{children}{visible && <View pointerEvents="box-none" style={s.host}>
    <ActiveToast key={visible.id} entry={visible} store={store} scope={scope} environment={environment} dismiss={() => api.dismiss(visible.id)} />
  </View>}</View></Context.Provider>;
}

/** Register multi-phase feature content in the same shared host and queue. */
export function ToastSlot({ children, id, dedupeKey, onShow, onDismiss }: { children: ReactNode; id: string; dedupeKey?: string; onShow?(): void; onDismiss?(reason: ToastDismissReason): void }) {
  const { show, update, dismiss } = useToast();
  const latest = useRef({ id, children, onShow, onDismiss });
  useLayoutEffect(() => { latest.current = { id, children, onShow, onDismiss }; }, [id, children, onShow, onDismiss]);
  useEffect(() => {
    const registered = show({ id, dedupeKey, durationMs: null, render: () => latest.current.id === id ? latest.current.children : null,
      onShow: () => { if (latest.current.id === id) latest.current.onShow?.(); },
      onDismiss: reason => { if (latest.current.id === id) latest.current.onDismiss?.(reason); } });
    if (registered !== id) latest.current.onDismiss?.('rejected');
    return () => { if (registered === id) dismiss(registered); };
  }, [show, dismiss, id, dedupeKey]);
  useEffect(() => { update(id, { render: () => latest.current.children }); }, [update, id, children]);
  return null;
}
const s = StyleSheet.create({
  root: { flex: 1 }, host: { position: 'absolute', top: 32, left: 16, right: 16, zIndex: 100, elevation: 12 },
  card: { width: '100%', maxWidth: layout.contentWidth, alignSelf: 'center', flexDirection: 'row', gap: 12, alignItems: 'center', padding: 16, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, elevation: 8, boxShadow: '0 8px 24px rgba(25,55,35,0.16)' },
  icon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1, minWidth: 0, gap: 3 },
  title: { ...typography.body, fontWeight: '700', color: colors.text }, message: { ...typography.secondary, color: colors.secondary },
});
