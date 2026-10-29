import type { ImageSourcePropType } from 'react-native';
import defaultHome from '../../assets/backgrounds/home-background.png';
import defaultFocus from '../../assets/backgrounds/focus-background.png';
import halloweenHome from '../../assets/backgrounds/home-background-halloween.png';
import halloweenFocus from '../../assets/backgrounds/focus-background-halloween.png';
const source = (asset: ImageSourcePropType | string): ImageSourcePropType => typeof asset === 'string' ? { uri: asset } : asset;
const artwork: Record<'home' | 'focus', Record<string, { source: ImageSourcePropType; label: string }>> = {
  home: { default: { source: source(defaultHome), label: '햇살이 드는 공부방' }, 'halloween-home': { source: source(halloweenHome), label: '핼러윈으로 꾸민 공부방' } },
  focus: { default: { source: source(defaultFocus), label: '함께 공부하는 공부방' }, 'halloween-focus': { source: source(halloweenFocus), label: '핼러윈으로 꾸민 집중 공부방' } },
};
export function resolveBackgroundArtwork(screen: 'home' | 'focus', id?: string | null) {
  return artwork[screen][id ?? 'default'] ?? artwork[screen].default;
}
