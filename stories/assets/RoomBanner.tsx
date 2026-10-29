import { Image, View, type ImageSourcePropType } from 'react-native';

/** The uploaded image includes all lettering, fabric, rope and clips. */
export function RoomBanner({ scene, screen, source, description }: { scene: { width: number; height: number }; screen: 'home' | 'focus'; source: ImageSourcePropType | string; description: string }) {
 const home = screen === 'home';
 const scale = home ? Math.max(scene.width / 1536, scene.height / 1024) : Math.max(scene.width / 1024, scene.height / 1100);
 const width = Math.min(scene.width - 32, (home ? 960 : 820) * scale);
 const height = width * (home ? 300 / 1200 : 300 / 1000);
 const top = home
  ? Math.max(68, (scene.height - 1024 * scale) / 2 + 200 * scale)
  : Math.max(12, scene.height * .78 - 912 * scale + 45 * scale);
 const image = typeof source === 'string' ? { uri: source } : source;
 return <View pointerEvents="none" style={{ position: 'absolute', left: (scene.width - width) / 2, top, width, height }}>
  <Image source={image} accessibilityLabel={`공부방 현수막: ${description}`} resizeMode="contain" fadeDuration={0} style={{ width, height }} />
 </View>;
}
