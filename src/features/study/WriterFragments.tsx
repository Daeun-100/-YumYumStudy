import { memo, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { WRITER_CYCLE_MS, writerColors, writerKeyframes, writerParticles, type WriterScreen } from '../../design/writer-particles';

const quotePath = 'M12 14C6 14 4 18 4 22C4 26 7 29 11 29C13 29 14 28 15 27C14 34 10 38 6 41L9 45C18 40 22 32 22 23C22 17 18 14 12 14Z M34 14C28 14 26 18 26 22C26 26 29 29 33 29C35 29 36 28 37 27C36 34 32 38 28 41L31 45C40 40 44 32 44 23C44 17 40 14 34 14Z';
const starPath = 'M30 13L34.42 25.58L47 30L34.42 34.42L30 47L25.58 34.42L13 30L25.58 25.58Z';

export const WriterFragments = memo(function WriterFragments({ screen, width, height, phase, strength }: { screen: WriterScreen; width: number; height: number; phase: number; strength: number }) {
  const [clock] = useState(() => new Animated.Value(0));
  const particles = useMemo(() => writerParticles(screen).map(particle => ({ ...particle, ...writerKeyframes(particle, screen) })), [screen]);
  const scale = width / (screen === 'home' ? 720 : 470);
  useEffect(() => {
    clock.setValue(0);
    const loop = Animated.sequence([
      Animated.delay(phase),
      Animated.loop(Animated.timing(clock, { toValue: 1, duration: WRITER_CYCLE_MS, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web', isInteraction: false })),
    ]);
    loop.start();
    return () => loop.stop();
  }, [clock, phase]);
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
    {particles.map(particle => {
      const interpolate = (key: keyof typeof particle.frames[number], factor = 1) => clock.interpolate({ inputRange: particle.inputRange, outputRange: particle.frames.map(frame => frame[key] * factor) });
      const size = 60 * scale;
      return <Animated.View key={particle.start} style={{ position: 'absolute', left: particle.x * width - size / 2, top: particle.y * height - (particle.kind === 'quote' ? 44 : 30) * scale, width: size, height: size, opacity: interpolate('opacity', Math.min(1, strength)), transform: [{ translateX: interpolate('dx', scale) }, { translateY: interpolate('dy', scale) }, { rotate: clock.interpolate({ inputRange: particle.inputRange, outputRange: particle.frames.map(frame => `${frame.rotation}deg`) }) }] }}>
        {particle.kind === 'quote' ? <View style={{ width: size, height: size, transform: [{ rotate: particle.direction < 0 ? '180deg' : '0deg' }, { scale: .85 }] }}><Svg width="100%" height="100%" viewBox="0 0 60 60"><Path d={quotePath} transform="translate(6 0)" fill={writerColors.quote} /></Svg></View> : <>
          <Animated.View style={{ position: 'absolute', width: size, height: size, opacity: interpolate('dotOpacity') }}><Svg width="100%" height="100%" viewBox="0 0 60 60"><Circle cx={30} cy={30} r={8} fill={writerColors.dot} /></Svg></Animated.View>
          {particle.kind === 'magic' && <Animated.View style={{ position: 'absolute', width: size, height: size, opacity: interpolate('starOpacity'), transform: [{ scale: interpolate('starScale') }] }}><Svg width="100%" height="100%" viewBox="0 0 60 60"><Path d={starPath} fill={writerColors.star} /></Svg></Animated.View>}
        </>}
      </Animated.View>;
    })}
  </View>;
});
