import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { SkinEffect, SkinEffectPlacement } from '../../design/skin-effects';

function useMotionAllowed() {
  const [reduced, setReduced] = useState(true);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    let mounted = true;
    let changed = false;
    const reduction = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { changed = true; setReduced(value); });
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted && !changed) setReduced(value); }).catch(() => {});
    const state = AppState.addEventListener('change', value => setActive(value === 'active'));
    const visibility = () => setVisible(document.visibilityState !== 'hidden');
    if (Platform.OS === 'web') { visibility(); document.addEventListener('visibilitychange', visibility); }
    return () => {
      mounted = false;
      reduction.remove(); state.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  return !reduced && active && visible;
}

function Steam({ placement, width, height, phase, strength }: { placement: SkinEffectPlacement; width: number; height: number; phase: number; strength: number }) {
  const [value] = useState(() => new Animated.Value(0));
  const plumeWidth = placement.width * width;
  const peakOpacity = Math.min(1, placement.opacity * strength);
  useEffect(() => {
    value.setValue(0);
    const loop = Animated.sequence([
      Animated.delay(phase),
      Animated.loop(Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
        Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
        Animated.delay(1000),
      ])),
    ]);
    loop.start();
    return () => loop.stop();
  }, [phase, value]);
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: placement.x * width - plumeWidth / 2, top: placement.y * height - plumeWidth * .7, width: plumeWidth, height: plumeWidth }}>
    {[0, 1, 2].map(index => <Animated.View key={index} style={{ position: 'absolute', width: plumeWidth, height: plumeWidth, opacity: value.interpolate({ inputRange: [0, .2, .65, 1], outputRange: [0, peakOpacity, peakOpacity * .7, 0] }), transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -plumeWidth * .8] }) }, { translateX: value.interpolate({ inputRange: [0, .5, 1], outputRange: [(index - 1) * plumeWidth * .32, ((index - 1) * .32 + .06) * plumeWidth, ((index - 1) * .32 - .06) * plumeWidth] }) }] }}>
      <Svg width="100%" height="100%" viewBox="0 0 60 60"><Path d="M 26 56 C 41 45 12 35 27 24 C 37 16 23 10 28 3" fill="none" stroke="#FFF2D9" strokeWidth={7} strokeLinecap="round" /></Svg>
    </Animated.View>)}
  </View>;
}

type SkinEffectsProps = { effects?: readonly SkinEffect[]; screen: 'home' | 'focus'; width: number; height: number; enabled?: boolean; strength?: number; phase?: number };

/** Decorative only; dimensions must match the full image canvas, not its opaque bounds. */
export function SkinEffects(props: SkinEffectsProps) {
  if (props.enabled === false || !props.effects?.length || props.width <= 0 || props.height <= 0 || props.strength === 0) return null;
  return <MotionEffects {...props} />;
}

function MotionEffects({ effects, screen, width, height, strength = 1, phase = 0 }: SkinEffectsProps) {
  const allowed = useMotionAllowed();
  if (!allowed) return null;
  return <>{effects?.map((effect, index) => {
    switch (effect.kind) {
      case 'warmSteam': return <Steam key={`${screen}-${index}`} placement={effect[screen]} width={width} height={height} phase={phase} strength={Math.max(0, Math.min(2, strength))} />;
    }
  })}</>;
}
