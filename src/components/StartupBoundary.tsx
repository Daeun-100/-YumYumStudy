import { useEffect, useState, type PropsWithChildren } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { useIdentity } from './IdentityProvider';
import { useStudy } from '../features/study/StudyProvider';
import { characters } from '../features/profile/CharacterPicker';
import { characterArtwork } from '../design/character-artwork';
import { StartupScreen } from './StartupScreen';

const backgrounds = [require('../../assets/backgrounds/home-background.png'), require('../../assets/backgrounds/focus-background.png')];

/** Keep navigation mounted for layout measurement while covering all partial data. */
export function StartupBoundary({ children }: PropsWithChildren) {
  const identity = useIdentity();
  const study = useStudy();
  const [opened, setOpened] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [expired, setExpired] = useState(false);
  const [loaded, setLoaded] = useState<string[]>([]);
  const [assetError, setAssetError] = useState(false);
  const dataReady = !!identity.profile && !identity.loading && !identity.error && !!study.today && !!study.room && study.startupReady;
  const assets = new Map<string, ImageSourcePropType>();
  backgrounds.forEach((source, index) => assets.set(`background-${index}`, source));
  if (dataReady) {
    const ids = new Set([identity.profile!.character ?? 'bunny', ...study.room!.data.map(member => member.profile.character ?? 'bunny')]);
    ids.forEach(id => {
      assets.set(`home-${id}`, characters[id].image);
      assets.set(`focus-${id}`, characterArtwork[id].focus);
    });
  }
  const assetsReady = dataReady && [...assets.keys()].every(key => loaded.includes(key));
  useEffect(() => {
    if (opened) return;
    const deadline = setTimeout(() => setExpired(true), 20000);
    return () => clearTimeout(deadline);
  }, [attempt, opened]);
  useEffect(() => {
    if (opened || !assetsReady || expired || assetError) return;
    // Allow final character sources and measured layout to paint before revealing.
    let second: number | undefined;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setOpened(true)); });
    return () => { cancelAnimationFrame(first); if (second !== undefined) cancelAnimationFrame(second); };
  }, [assetsReady, opened, expired, assetError]);
  function retry() {
    setExpired(false); setAssetError(false); setLoaded([]); setAttempt(value => value + 1);
    if (identity.error || !identity.profile) identity.retry();
    else void study.retryStartup();
  }
  const failed = expired || assetError || (!identity.loading && !study.loading && (!!identity.error || !!study.startupError || (!study.today && !!study.error) || (!study.room && !!study.roomError)));
  return <View style={{ flex: 1 }}>
    <View style={{ flex: 1, opacity: opened ? 1 : 0 }} aria-hidden={!opened} pointerEvents={opened ? 'auto' : 'none'} accessibilityElementsHidden={!opened} importantForAccessibility={opened ? 'auto' : 'no-hide-descendants'}>{children}</View>
    {!opened && <>
      {dataReady && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.preload}>
        {[...assets].map(([key, source]) => <Image key={`${attempt}-${key}`} source={source} style={s.probe} fadeDuration={0}
          onLoad={() => setLoaded(previous => previous.includes(key) ? previous : [...previous, key])} onError={() => setAssetError(true)} />)}
      </View>}
      <StartupScreen failed={failed} onRetry={retry} />
    </>}
  </View>;
}
const s = StyleSheet.create({ preload: { position: 'absolute', width: 1, height: 1, opacity: 0 }, probe: { width: 1, height: 1 } });
