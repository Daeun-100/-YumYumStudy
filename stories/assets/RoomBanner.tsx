import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

/** Presentation draft only; the same message is shared by both scenes. */
export function RoomBanner({ scene, screen, message }: { scene: { width: number; height: number }; screen: 'home' | 'focus'; message: string }) {
 const home = screen === 'home';
 const scale = home ? Math.max(scene.width / 1536, scene.height / 1024) : Math.max(scene.width / 1024, scene.height / 1100);
 const width = Math.min(scene.width - 32, (home ? 960 : 820) * scale);
 const height = width * .255;
 const top = home
  ? Math.max(68, (scene.height - 1024 * scale) / 2 + 200 * scale)
  : Math.max(12, scene.height * .78 - 912 * scale + 45 * scale);
 const long = [...message].length > 21;
 return <View pointerEvents="none" accessible accessibilityLabel={`공부방 현수막: ${message}`} style={{ position: 'absolute', left: (scene.width - width) / 2, top, width, height }}>
  <Svg width={width} height={height} viewBox="0 0 360 92" style={{ position: 'absolute' }}>
   <Path d="M14 9 Q180 42 346 9" fill="none" stroke="#786449" strokeWidth={2.6} />
   <Circle cx={14} cy={8} r={3.5} fill="#7B644A" /><Circle cx={346} cy={8} r={3.5} fill="#7B644A" />
   <Path d="M28 24 Q180 39 332 24 L336 76 Q180 99 24 76 Z" fill="#715336" opacity={.15} />
   <Path d="M26 17 Q180 31 334 17 L338 69 Q180 91 22 69 Z" fill={home ? '#FFF2CD' : '#F8E5B9'} stroke="#B89460" strokeWidth={1.5} strokeLinejoin="round" />
   <Path d="M26 17 L42 20 L38 72 L22 69 Z M318 20 L334 17 L338 69 L322 72 Z" fill="#E8D09E" opacity={.65} />
   <Path d="M44 27 Q180 39 316 27 M42 65 Q180 81 318 65" fill="none" stroke="#C8AA78" strokeWidth={1} opacity={.65} />
   <Path d="M30 13 L32 30 M328 13 L326 30" fill="none" stroke="#8D704A" strokeWidth={5} strokeLinecap="round" />
   <Path d="M30 13 L32 30 M328 13 L326 30" fill="none" stroke="#D2AE74" strokeWidth={2.5} strokeLinecap="round" />
  </Svg>
  <View style={{ position: 'absolute', left: width * .12, right: width * .12, top: height * .30, bottom: height * .19, alignItems: 'center', justifyContent: 'center' }}>
   <Text numberOfLines={2} style={{ color: '#425B3B', fontWeight: '700', fontSize: width * (long ? .038 : .048), lineHeight: width * (long ? .052 : .062), textAlign: 'center', letterSpacing: -.3 }}>{message}</Text>
  </View>
 </View>;
}
