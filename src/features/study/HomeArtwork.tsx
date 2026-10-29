import { SkinEffects } from './SkinEffects';
import { Image, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { resolveCharacterArtwork } from '../../design/skin-artwork';
import type { CharacterId } from '../../lib/characters';

const background = require('../../../assets/backgrounds/home-background.png');

// Source-canvas anchor is the prop base, excluding transparent margins and glow.
const placements: Record<CharacterId, { scale: number; x: number; y: number }> = {
  bunny: { scale: .72, x: 768, y: 860 },
  bear: { scale: .72, x: 768, y: 860 },
  puppy: { scale: .72, x: 768, y: 860 },
  cat: { scale: .60, x: 768, y: 934 },
  maltese: { scale: .55, x: 768, y: 930 },
  pomeranian: { scale: .60, x: 768, y: 900 },
  blackcat: { scale: .60, x: 768, y: 910 },
};

/** Shared by the app and the asset placement preview. */
export function HomeArtwork({ character, activeSkinId, width, height, placementOverride, effectsEnabled = true, effectStrength = 1, backgroundSource = background }: { character: CharacterId; activeSkinId?: string | null; width: number; height: number; placementOverride?: Partial<{ scale: number; x: number; y: number }>; effectsEnabled?: boolean; effectStrength?: number; backgroundSource?: ImageSourcePropType }) {
  const scale = Math.max(width / 1536, height / 1024);
  const left = (width - 1536 * scale) / 2;
  const top = (height - 1024 * scale) / 2;
  const artwork = resolveCharacterArtwork(character, activeSkinId);
  const placement = { ...(artwork.homePlacement ?? placements[character]), ...placementOverride };
  return <>
    <Image fadeDuration={0} source={backgroundSource} resizeMode="contain" style={{ position: 'absolute', left, top, width: 1536 * scale, height: 1024 * scale }} accessibilityLabel="홈 공부방 배경" />
    <View pointerEvents="none" style={{ position: 'absolute', left: left + (800 - placement.x * placement.scale) * scale, top: top + (785 - placement.y * placement.scale) * scale - 2, width: 1536 * placement.scale * scale, height: 1024 * placement.scale * scale }}>
      <Image fadeDuration={0} source={artwork.home} resizeMode="contain" style={{ width: '100%', height: '100%' }} accessibilityLabel={`${artwork.label} 홈 캐릭터`} />
      <SkinEffects effects={artwork.effects} screen="home" width={1536 * placement.scale * scale} height={1024 * placement.scale * scale} enabled={effectsEnabled} strength={effectStrength} />
    </View>
  </>;
}
