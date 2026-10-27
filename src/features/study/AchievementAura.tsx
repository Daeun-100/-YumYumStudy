import { Image, View } from 'react-native';
import { BlackCatAura } from './BlackCatAura';
import type { CharacterId } from '../../lib/characters';
const effects = {
  bunny: require('../../../assets/effects/achievement/bunny-sparkle.png'),
  bear: require('../../../assets/effects/achievement/bear-sparkle.png'),
  cat: require('../../../assets/effects/achievement/cat-sparkle.png'),
  puppy: require('../../../assets/effects/achievement/puppy-sparkle.png'),
  maltese: require('../../../assets/effects/achievement/maltese-sparkle.png'),
  pomeranian: require('../../../assets/effects/achievement/pomeranian-sparkle.png'),
  blackcat: require('../../../assets/effects/achievement/blackcat-sparkle.png'),
};
const alignment: Record<CharacterId, { scale: number; x: number; y: number }> = {
  bunny: { scale: 1.01, x: 0, y: 0 },
  bear: { scale: 1.05, x: 0, y: -3 },
  cat: { scale: 1.08, x: 0, y: 0 },
  puppy: { scale: 1.07, x: 0, y: 0 },
  maltese: { scale: 1.01, x: 0, y: 0 },
  pomeranian: { scale: 1, x: -4, y: -3 },
  blackcat: { scale: .89, x: -2, y: -24 },
};

/** One transparent effect layer behind the matching focus artwork. */
export function AchievementAura({ character, size, opacity = 1 }: { character: CharacterId; size: number; opacity?: number }) {
  if (character === 'blackcat') return <BlackCatAura size={size} opacity={opacity} />;
  const placement = alignment[character];
  const layer = (dx = 0, dy = 0) => <Image source={effects[character]} resizeMode="contain" style={{ position: 'absolute', width: size, height: size, opacity, transform: [{ translateX: (placement.x + dx) * size / 280 }, { translateY: (placement.y + dy) * size / 280 }, { scale: placement.scale }] }} />;
  if (character !== 'pomeranian') return <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size }}>{layer()}</View>;
  const split = .62;
  const shifts = [3, -9];
  const lowerY = -3;
  // Separate non-overlapping regions keep stars single while aligning the hands.
  return <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size }}>
    <View style={{ position: 'absolute', width: size, height: size * split, overflow: 'hidden' }}>{layer()}</View>
    {shifts.map((dx, index) => <View key={index} style={{ position: 'absolute', top: size * split, left: index * size / 2, width: size / 2, height: size * (1 - split), overflow: 'hidden' }}><View style={{ position: 'absolute', top: -size * split, left: -index * size / 2 }}>{layer(dx, lowerY)}</View></View>)}
  </View>;
}
