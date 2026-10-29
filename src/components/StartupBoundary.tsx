import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { View } from 'react-native';
import { useIdentity } from './IdentityProvider';
import { useStudy } from '../features/study/StudyProvider';
import { StartupScreen } from './StartupScreen';
import { finishTiming } from '../lib/performance';
const StartupVisibility = createContext(false);
export const useStartupVisible = () => useContext(StartupVisibility);

/** Keep navigation mounted, revealing it once the live owner state is ready. */
export function StartupBoundary({ children }: PropsWithChildren) {
  const identity = useIdentity();
  const study = useStudy();
  const [opened, setOpened] = useState(false);
  const [finishStartup] = useState(() => finishTiming('startup.visible'));
  const reported = useRef(false);
  useEffect(() => {
    if (opened && !reported.current) { reported.current = true; finishStartup(); }
  }, [opened, finishStartup]);
  const [attempt, setAttempt] = useState(0);
  const [expired, setExpired] = useState(false);
  // Only live owner data and pending-start recovery can unlock timer controls.
  // Friend data and artwork load independently inside the mounted screens.
  const dataReady = !!identity.profile && !identity.loading && !identity.error && !!study.today && study.startupReady;
  useEffect(() => {
    if (opened) return;
    const deadline = setTimeout(() => setExpired(true), 20000);
    return () => clearTimeout(deadline);
  }, [attempt, opened]);
  useEffect(() => {
    if (opened || !dataReady || expired) return;
    // Give the live state and measured layout a chance to paint before revealing.
    let second: number | undefined;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setOpened(true)); });
    return () => { cancelAnimationFrame(first); if (second !== undefined) cancelAnimationFrame(second); };
  }, [dataReady, opened, expired]);
  function retry() {
    setExpired(false); setAttempt(value => value + 1);
    if (identity.error || !identity.profile) identity.retry();
    else void study.retryStartup();
  }
  const failed = expired || (!identity.loading && !study.loading && (!!identity.error || !!study.startupError || (!study.today && !!study.error)));
  return <View style={{ flex: 1 }}>
    <View style={{ flex: 1, opacity: opened ? 1 : 0 }} aria-hidden={!opened} pointerEvents={opened ? 'auto' : 'none'} accessibilityElementsHidden={!opened} importantForAccessibility={opened ? 'auto' : 'no-hide-descendants'}><StartupVisibility.Provider value={opened}>{children}</StartupVisibility.Provider></View>
    {!opened && <>
      <StartupScreen failed={failed} onRetry={retry} />
    </>}
  </View>;
}
