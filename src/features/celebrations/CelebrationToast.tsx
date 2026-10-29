import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LeavePlaneIcon } from '../../design/LeavePlaneIcon';
import { designAssets } from '../../design/assets';
import { colors, layout, typography } from '../../design/theme';
import type { Celebration } from './model';
import { createRewardTiming } from './reward-timing';

const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
const native = Platform.OS !== 'web';
const rewardStars = [
  { position: { top: 8, right: '12%' }, size: 28, gold: false },
  { position: { bottom: 16, left: '9%' }, size: 23, gold: false },
  { position: { top: 17, left: '14%' }, size: 13, gold: true },
  { position: { bottom: 12, right: '17%' }, size: 14, gold: true },
] as const;
function FourPointStar({ size, color }: { size: number; color: string }) {
  return <Svg width={size} height={size * 1.1} viewBox="0 0 24 24"><Path d="M12 0C12 8 16 12 24 12C16 12 12 16 12 24C12 16 8 12 0 12C8 12 12 8 12 0Z" fill={color} /></Svg>;
}
type Props = {
  notice: Celebration; onDismiss(): void;
  reducedMotion?: boolean; screenReader?: boolean;
  /** Static states are useful in Storybook; the app always plays the sequence. */
  previewPhase?: 'stamp' | 'reward'; autoDismiss?: boolean;
};
function CelebrationSparkle({ still }: { still: boolean }) {
  const [twinkle] = useState(() => new Animated.Value(still ? 1 : 0));
  useEffect(() => {
    if (still) return;
    const animation = Animated.timing(twinkle, { toValue: 1, duration: 480, easing: Easing.linear, useNativeDriver: native, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [still, twinkle]);
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.spark}>
    <Animated.View style={{ opacity: twinkle.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 1, 1] }),
      transform: [{ scale: twinkle.interpolate({ inputRange: [0, 0.3, 0.65, 1], outputRange: [0.45, 1.25, 0.88, 1] }) }],
    }}><FourPointStar size={20} color={colors.primary} /></Animated.View>
  </View>;
}
export function CelebrationToast({ notice, onDismiss, reducedMotion = false, screenReader = false, previewPhase, autoDismiss = true }: Props) {
  const [phase, setPhase] = useState<'stamp' | 'collect' | 'reward'>(previewPhase ?? 'stamp');
  const [sparkleReady, setSparkleReady] = useState(!!previewPhase || reducedMotion);
  const [width, setWidth] = useState(280);
  const [entrance] = useState(() => new Animated.Value(previewPhase || reducedMotion ? 1 : 0));
  const [stamp] = useState(() => new Animated.Value(previewPhase || reducedMotion ? 1 : 0));
  const [collect] = useState(() => new Animated.Value(previewPhase === 'reward' ? 1 : 0));
  const callbacks = useRef({ onDismiss });
  useLayoutEffect(() => { callbacks.current = { onDismiss }; }, [onDismiss]);
  const timingRef = useRef<ReturnType<typeof createRewardTiming> | null>(null);
  useEffect(() => {
    if (previewPhase) return;
    let alive = true;
    const announce = (message: string) => { if (screenReader && Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(message); };
    const timing = (value: Animated.Value, toValue: number, duration: number, driver = native) => Animated.timing(value, { toValue, duration: reducedMotion ? 0 : duration, easing: Easing.out(Easing.cubic), useNativeDriver: driver, isInteraction: false });
    let collection: Animated.CompositeAnimation | undefined;
    const lifetime = createRewardTiming({
      now: () => performance.now(), setTimer: (run, ms) => setTimeout(run, ms), clearTimer: timer => clearTimeout(timer),
      goalMs: screenReader ? 10000 : 4000, rewardMs: screenReader ? 10000 : 3000,
      holdMs: reducedMotion ? 0 : 800, autoDismiss,
      onExpire: () => {
        timing(entrance, 0, 200).start(({ finished }) => { if (finished && alive) callbacks.current.onDismiss(); });
      },
      onCollect: () => {
        if (!alive) return;
        setPhase('collect');
        collection = timing(collect, 1, 900, false);
        collection.start(({ finished }) => {
          if (!finished || !alive) return;
          setPhase('reward');
          announce('보상 연차를 받았어요! 연차 1개가 추가됐어요.');
          lifetime.rewardFinished();
        });
      },
    });
    timingRef.current = lifetime;
    lifetime.update(notice.reward, !!notice.rewardPending);
    const animation = Animated.parallel([timing(entrance, 1, 380), Animated.sequence([Animated.delay(reducedMotion ? 0 : 160), timing(stamp, 1, 600)])]);
    const sparkleDelay = Animated.delay(reducedMotion ? 0 : 380);
    sparkleDelay.start(({ finished }) => { if (finished && alive) setSparkleReady(true); });
    announce('오늘 목표 달성!');
    animation.start(({ finished }) => { if (finished && alive) lifetime.stamped(); });
    return () => {
      alive = false; lifetime.dispose(); timingRef.current = null;
      animation.stop(); sparkleDelay.stop(); collection?.stop(); entrance.stopAnimation(); stamp.stopAnimation(); collect.stopAnimation();
    };
    // Reward responses update the lifetime below; they must never replay the stamp animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice.date, reducedMotion, screenReader, previewPhase, autoDismiss]);
  useEffect(() => { timingRef.current?.update(notice.reward, !!notice.rewardPending); }, [notice.reward, notice.rewardPending]);

  const rewardVisible = phase !== 'stamp';
  const title = rewardVisible ? '보상 연차를 받았어요!' : '오늘 목표 달성!';
  return <Animated.View testID="celebration-toast" style={[s.card, {
    opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
    backgroundColor: colors.surface,
  }]}>
    <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={s.title}>{title}</Text>
    <Animated.View style={{ height: collect.interpolate({ inputRange: [0, 1], outputRange: [78, 116] }) }}>
      {phase !== 'reward' && <Animated.View onLayout={event => setWidth(event.nativeEvent.layout.width)}
        accessibilityElementsHidden={rewardVisible} importantForAccessibility={rewardVisible ? 'no-hide-descendants' : 'auto'}
        style={[s.week, { opacity: collect.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 0.7, 0] }) }]}>
        {notice.days.map((day, index) => {
          const today = index === notice.todayIndex;
          const gathers = day.achieved && !day.leave;
          const shift = gathers ? (3 - index) * width / 7 : 0;
          return <View key={day.date} style={[s.day, today && s.today]} accessible accessibilityLabel={`${weekdays[index]}요일${today ? ', 오늘' : ''}, ${day.achieved ? '목표 달성' : day.leave ? '연차' : day.rest ? '휴무' : '미달성'}`}>
            <Text style={[s.weekday, today && { color: colors.primary, fontWeight: '700' }]}>{weekdays[index]}</Text>
            <View style={[s.slot, !day.achieved && !day.rest && !day.leave && s.empty, (day.rest || day.leave) && s.restSlot]}>
              {day.achieved ? <Animated.View style={{ opacity: today ? stamp : 1, transform: [
                { translateX: collect.interpolate({ inputRange: [0, 1], outputRange: [0, shift] }) },
                { translateY: collect.interpolate({ inputRange: [0, 1], outputRange: [0, 17] }) },
                { scale: collect.interpolate({ inputRange: [0, 1], outputRange: [1, gathers ? 0.25 : 0.8] }) },
              ] }}><Animated.View style={{ transform: [{ scale: today ? stamp.interpolate({ inputRange: [0, 0.55, 0.8, 1], outputRange: [1.8, 0.86, 1.08, 1] }) : 1 }, { rotate: today ? stamp.interpolate({ inputRange: [0, 1], outputRange: ['-15deg', '0deg'] }) : '0deg' }] }}><Image accessible={false} source={designAssets.watermelon} resizeMode="contain" style={s.melon} /></Animated.View></Animated.View> : (day.rest || day.leave) ? <LeavePlaneIcon /> : null}
              {today && day.achieved && sparkleReady && phase === 'stamp' && <CelebrationSparkle still={reducedMotion || !!previewPhase} />}
            </View>
          </View>;
        })}
      </Animated.View>}
      {rewardVisible && <Animated.View testID="celebration-reward" style={[s.reward, {
        opacity: collect.interpolate({ inputRange: [0, 0.3, 0.75, 1], outputRange: [0, 0, 1, 1] }),
        transform: [{ scale: collect.interpolate({ inputRange: [0, 0.3, 0.8, 1], outputRange: [0.6, 0.6, 1.05, 1] }) }],
      }]}>
        <View style={s.ticket}><View style={[s.notch, { left: -8 }]} /><Text accessibilityLabel="연차 1개 추가" style={s.amount}>+1</Text><View style={[s.notch, { right: -8 }]} /></View>
        <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.decoration}>
          {rewardStars.map(({ position, size, gold }, index) => <Animated.View key={index} style={[s.rewardStar, position, {
            opacity: collect.interpolate({ inputRange: [0, 0.35 + index * 0.06, 0.8, 1], outputRange: [0, 0, 1, 1] }),
            transform: [{ scale: collect.interpolate({ inputRange: [0, 0.4, 0.72, 0.87, 1], outputRange: [0.3, 0.3, 1.25, 0.88, 1] }) }],
          }]}><FourPointStar size={size} color={gold ? colors.accent : colors.primary} /></Animated.View>)}
          <View style={[s.rewardDot, { top: 57, right: '7%' }]} /><View style={[s.rewardDot, { top: 15, left: '34%', width: 3, height: 3 }]} />
        </View>
      </Animated.View>}
    </Animated.View>

  </Animated.View>;
}
const s = StyleSheet.create({
  card: { width: '100%', maxWidth: layout.contentWidth, alignSelf: 'center', borderRadius: 25, borderWidth: 1, borderColor: colors.border, padding: 16, paddingBottom: 8, elevation: 8, boxShadow: '0 8px 24px rgba(25,55,35,0.16)' },
  title: { ...typography.body, fontWeight: '700', color: colors.text, marginBottom: 13 },
  week: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', paddingTop: 3 },
  day: { flex: 1, minWidth: 0, alignItems: 'center', gap: 10, paddingVertical: 7, marginTop: -7, borderRadius: 18 }, weekday: { fontSize: 11, color: colors.secondary },
  today: { backgroundColor: colors.soft }, restSlot: { backgroundColor: colors.leaveIconBackground },
  spark: { position: 'absolute', right: -9, top: -10 },
  slot: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.track },
  melon: { width: 32, height: 32 }, reward: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  ticket: { width: 134, height: 96, borderRadius: 14, borderWidth: 1, borderColor: colors.leaveIconBackground, backgroundColor: colors.leaveBackground, boxShadow: `0 4px 0 ${colors.leaveIconBackground}`, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] },
  notch: { position: 'absolute', top: 39, width: 15, height: 15, borderRadius: 8, backgroundColor: colors.surface }, amount: { fontSize: 54, lineHeight: 64, fontWeight: '700', color: colors.leave, letterSpacing: -3 },
  decoration: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  rewardStar: { position: 'absolute' }, rewardDot: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },

});
