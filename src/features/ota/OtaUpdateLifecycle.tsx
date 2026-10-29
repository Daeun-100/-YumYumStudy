import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Keyboard, Platform, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { usePathname } from 'expo-router';
import { useStudy } from '../study/StudyProvider';
import { useLeave } from '../leave/LeaveProvider';
import { useIdentity } from '../../components/IdentityProvider';
import { activeRoomOperations, roomSwitching } from '../../lib/room';
import { colors, spacing, typography } from '../../design/theme';
import { createOtaController } from './controller';
import { beginUpdateReload, cancelUpdateReload, updateReloadBlocked } from './reload-gate';

// Mount no OTA hooks on web/Expo Go/development builds.
export function OtaUpdateLifecycle() {
  if (Platform.OS === 'web' || !Updates.isEnabled || __DEV__) return null;
  return <NativeOtaUpdates />;
}
function NativeOtaUpdates() {
  const study = useStudy();
  const leave = useLeave();
  const identity = useIdentity();
  const pathname = usePathname();
  const { isUpdatePending } = Updates.useUpdates();
  const [pending, setPending] = useState(false);
  const [reloading, setReloading] = useState(false);
  const current = useRef({ study, leave, identity, pathname });
  useLayoutEffect(() => { current.current = { study, leave, identity, pathname }; });

  const controllerRef = useRef<ReturnType<typeof createOtaController> | null>(null);
  useEffect(() => {
    const active = () => AppState.currentState === 'active';
    const controller = createOtaController({
      active,
      safe: () => {
        const { study: s, leave: l, identity: i, pathname: path } = current.current;
        return (path === '/' || path === '/focus') && !i.loading && !i.error && !!i.profile
          && s.startupReady && !!s.today && !s.today.data.activeSession && !s.loading && !s.busy
          && !s.actionFailed && !s.error && !s.startupError && !l.busy && !l.actionFailed && !l.error
          && !roomSwitching && activeRoomOperations === 0 && !Keyboard.isVisible() && !updateReloadBlocked();
      },
      check: Updates.checkForUpdateAsync,
      fetch: Updates.fetchUpdateAsync,
      prepare: () => current.current.study.prepareUpdateReload(),
      begin: () => {
        if (!beginUpdateReload()) return false;
        setReloading(true);
        return true;
      },
      reload: () => Updates.reloadAsync(),
      cancel: () => { cancelUpdateReload(); setReloading(false); },
      changed: () => setPending(true),
      now: Date.now,
    });
    controllerRef.current = controller;
    void controller.check();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void controller.check();
    });
    return () => { controller.dispose(); controllerRef.current = null; subscription.remove(); };
  }, []);
  useEffect(() => {
    // Also observe downloads performed by Expo's built-in startup check.
    if (isUpdatePending) controllerRef.current?.downloaded();
  }, [isUpdatePending]);

  useEffect(() => {
    if (!pending) return;
    // Local eligibility checks only while an update is pending; EAS is not polled.
    const timer = setInterval(() => { void controllerRef.current?.apply(); }, 1000);
    return () => clearInterval(timer);
  }, [pending]);

  if (!pending) return null;
  if (reloading) return <View style={styles.applying} accessibilityViewIsModal>
    <Text accessibilityLiveRegion="polite" style={styles.text}>업데이트를 적용하고 있어요…</Text>
  </View>;
  return <View pointerEvents="none" style={styles.notice}>
    <Text accessibilityLiveRegion="polite" style={styles.text}>{study.today?.data.activeSession
      ? '업데이트 준비 완료 · 공부가 끝나면 자동 적용돼요'
      : '업데이트 준비 완료 · 작업을 마치고 홈이나 공부방으로 돌아오면 자동 적용돼요'}</Text>
  </View>;
}
const styles = StyleSheet.create({
  notice: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.soft },
  text: { ...typography.caption, color: colors.text, textAlign: 'center' },
  applying: { ...StyleSheet.absoluteFill, zIndex: 1000, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
});
