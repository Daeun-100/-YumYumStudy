import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Keyboard, Platform, StyleSheet, View } from 'react-native';
import * as Updates from 'expo-updates';
import { usePathname } from 'expo-router';
import { useStudy } from '../study/StudyProvider';
import { useLeave } from '../leave/LeaveProvider';
import { useIdentity } from '../../components/IdentityProvider';
import { activeRoomOperations, roomSwitching } from '../../lib/room';
import { useToast } from '../../design/toast';
import { createOtaController, type OtaSnapshot } from './controller';
import { beginUpdateReload, cancelUpdateReload, updateReloadBlocked } from './reload-gate';

type OtaState = OtaSnapshot & { enabled: boolean; check(): Promise<void>; apply(): Promise<void> };
const disabled: OtaState = { enabled: false, pending: false, phase: 'idle', check: async () => {}, apply: async () => {} };
const Context = createContext<OtaState>(disabled);
export function useOtaUpdate() { return useContext(Context); }

// Keep native OTA hooks out of web, Expo Go and development builds.
export function OtaUpdateProvider({ children }: PropsWithChildren) {
  if (Platform.OS === 'web' || !Updates.isEnabled || __DEV__) return <Context.Provider value={disabled}>{children}</Context.Provider>;
  return <NativeOtaUpdateProvider>{children}</NativeOtaUpdateProvider>;
}
function NativeOtaUpdateProvider({ children }: PropsWithChildren) {
  const study = useStudy();
  const leave = useLeave();
  const identity = useIdentity();
  const pathname = usePathname();
  const toast = useToast();
  const { isUpdatePending } = Updates.useUpdates();
  const [snapshot, setSnapshot] = useState<OtaSnapshot>({ pending: false, phase: 'idle' });
  const [reloading, setReloading] = useState(false);
  const current = useRef({ study, leave, identity, pathname });
  useLayoutEffect(() => { current.current = { study, leave, identity, pathname }; }, [study, leave, identity, pathname]);
  const controllerRef = useRef<ReturnType<typeof createOtaController> | null>(null);
  useEffect(() => {
    const controller = createOtaController({
      active: () => AppState.currentState === 'active',
      safe: () => {
        const { study: s, leave: l, identity: i, pathname: path } = current.current;
        return path === '/profile' && !i.loading && !i.error && !!i.profile
          && s.startupReady && !!s.today && !s.today.data.activeSession && !s.busy
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
      changed: setSnapshot,
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
    // Expo may download during startup. Mark it ready without reloading or a toast.
    if (isUpdatePending) controllerRef.current?.downloaded();
  }, [isUpdatePending]);

  const check = useCallback(async () => {
    const result = await controllerRef.current?.check(true);
    if (result === 'failed') toast.show({ message: '업데이트를 확인하지 못했어요. 다시 시도해 주세요.', showIcon: false });
  }, [toast]);
  const apply = useCallback(async () => {
    const result = await controllerRef.current?.apply();
    if (result === 'blocked') {
      const { study: s, leave: l } = current.current;
      const message = s.today?.data.activeSession ? '공부를 마친 뒤 적용해 주세요.'
        : s.busy || l.busy || activeRoomOperations > 0 ? '저장이 끝난 뒤 다시 눌러 주세요.'
          : '공부 기록과 진행 중인 작업을 확인한 뒤 다시 눌러 주세요.';
      toast.show({ message, showIcon: false, durationMs: 2500 });
    } else if (result === 'failed') toast.show({ message: '업데이트를 적용하지 못했어요. 다시 시도해 주세요.', showIcon: false });
  }, [toast]);
  const value = useMemo<OtaState>(() => ({ ...snapshot, enabled: true, check, apply }), [snapshot, check, apply]);
  return <Context.Provider value={value}>{children}{reloading && <View style={styles.blockInput} accessibilityViewIsModal />}</Context.Provider>;
}
const styles = StyleSheet.create({ blockInput: { ...StyleSheet.absoluteFill, zIndex: 1000 } });
