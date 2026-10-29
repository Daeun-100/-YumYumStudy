import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, X } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { LeavePlaneIcon } from '../../design/LeavePlaneIcon';
import { designAssets } from '../../design/assets';
import { colors, layout, typography } from '../../design/theme';
import type { Celebration } from './model';

const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
const native = Platform.OS !== 'web';
type Props = {
  notice: Celebration; onDismiss(): void; onViewReward(): void;
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
    }}><Svg width={20} height={23} viewBox="0 0 24 24"><Path d="M12 0C12 8 16 12 24 12C16 12 12 16 12 24C12 16 8 12 0 12C8 12 12 8 12 0Z" fill={colors.primary} /></Svg></Animated.View>
  </View>;
}
export function CelebrationToast({ notice, onDismiss, onViewReward, reducedMotion = false, screenReader = false, previewPhase, autoDismiss = true }: Props) {
  const [phase, setPhase] = useState<'stamp' | 'collect' | 'reward'>(previewPhase ?? 'stamp');
  const [sparkleReady, setSparkleReady] = useState(!!previewPhase || reducedMotion);
  const [width, setWidth] = useState(280);
  const [entrance] = useState(() => new Animated.Value(previewPhase || reducedMotion ? 1 : 0));
  const [stamp] = useState(() => new Animated.Value(previewPhase || reducedMotion ? 1 : 0));
  const [collect] = useState(() => new Animated.Value(previewPhase === 'reward' ? 1 : 0));
  const callbacks = useRef({ onDismiss, onViewReward });
  useLayoutEffect(() => { callbacks.current = { onDismiss, onViewReward }; }, [onDismiss, onViewReward]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closing = useRef(false);
  const remaining = useRef(0);
  const hold = useRef(false);
  const since = useRef(0);
  const ready = useRef(false);
  const dismissRef = useRef<(view?: boolean) => void>(() => {});
  const clearTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const schedule = (ms: number) => {
    clearTimer(); remaining.current = ms;
    if (!autoDismiss || hold.current || previewPhase) return;
    since.current = Date.now();
    timer.current = setTimeout(() => dismissRef.current(), ms);
  };
  useLayoutEffect(() => { dismissRef.current = (view = false) => {
    if (closing.current) return;
    closing.current = true; clearTimer();
    Animated.timing(entrance, { toValue: 0, duration: reducedMotion ? 0 : 200, useNativeDriver: native }).start(({ finished }) => {
      if (finished) { if (view) callbacks.current.onViewReward(); else callbacks.current.onDismiss(); }
    });
  }; }, [entrance, reducedMotion]);
  useEffect(() => {
    if (previewPhase) return;
    let alive = true;
    const announce = (message: string) => { if (screenReader && Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(message); };
    const timing = (value: Animated.Value, toValue: number, duration: number, driver = native) => Animated.timing(value, { toValue, duration: reducedMotion ? 0 : duration, easing: Easing.out(Easing.cubic), useNativeDriver: driver, isInteraction: false });
    const animation = Animated.sequence([
      Animated.parallel([timing(entrance, 1, 380), Animated.sequence([Animated.delay(reducedMotion ? 0 : 160), timing(stamp, 1, 600)])]),
    ]);
    let collection: Animated.CompositeAnimation | undefined;
    // Reveal at the stamp's first contact, while its small settling bounce continues.
    const sparkleDelay = Animated.delay(reducedMotion ? 0 : 380);
    sparkleDelay.start(({ finished }) => { if (finished && alive) setSparkleReady(true); });
    announce('오늘 목표 달성!');
    animation.start(({ finished }) => {
      if (!finished || !alive) return;
      if (!notice.reward) {
        ready.current = true; schedule(screenReader ? 10000 : 4000); return;
      }
      collection = Animated.delay(reducedMotion ? 0 : 800);
      collection.start(({ finished: held }) => {
        if (!held || !alive) return;
        setPhase('collect');
        // Height and six converging stamps share one short JS-driven animation.
        collection = timing(collect, 1, 900, false);
        collection.start(({ finished: gathered }) => {
          if (!gathered || !alive) return;
          setPhase('reward'); ready.current = true;
          announce('보상 연차를 받았어요! 연차 1개가 추가됐어요.');
          schedule(screenReader ? 10000 : 6000);
        });
      });
    });
    return () => { alive = false; animation.stop(); sparkleDelay.stop(); collection?.stop(); clearTimer(); entrance.stopAnimation(); stamp.stopAnimation(); collect.stopAnimation(); };
    // One mounted notice owns one animation. Callback changes must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice.date, notice.reward, reducedMotion, screenReader, previewPhase, autoDismiss]);

  function focus() {
    if (!screenReader) return;
    hold.current = true;
    if (timer.current) remaining.current = Math.max(0, remaining.current - (Date.now() - since.current));
    clearTimer();
  }
  function blur() { if (screenReader) { hold.current = false; if (ready.current) schedule(Math.max(2000, remaining.current)); } }
  const rewardVisible = phase !== 'stamp';
  const title = rewardVisible ? '보상 연차를 받았어요!' : '오늘 목표 달성!';
  return <Animated.View testID="celebration-toast" style={[s.card, {
    opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
    backgroundColor: collect.interpolate({ inputRange: [0, 1], outputRange: [colors.surface, colors.leaveBackground] }),
  }]}>
    <Pressable accessibilityRole="button" accessibilityLabel="성취 알림 닫기" onPress={() => dismissRef.current()} onFocus={focus} onBlur={blur} style={({ pressed }) => [s.close, pressed && { backgroundColor: colors.surfacePressed }]}><X size={18} strokeWidth={1.8} color={colors.secondary} /></Pressable>
    <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={s.title}>{title}</Text>
    <Animated.View style={{ height: collect.interpolate({ inputRange: [0, 1], outputRange: [78, 148] }) }}>
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
        <View style={s.ticket}><View style={[s.notch, { left: -9 }]} /><Text accessibilityLabel="연차 1개 추가" style={s.amount}>+1</Text><View style={[s.notch, { right: -9 }]} /></View>
      </Animated.View>}
    </Animated.View>
    {rewardVisible && <Animated.View style={{ opacity: collect, height: collect.interpolate({ inputRange: [0, 1], outputRange: [0, 44] }), overflow: 'hidden' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="보상 연차 내역 확인하기" disabled={phase !== 'reward'} onFocus={focus} onBlur={blur} onPress={() => dismissRef.current(true)} style={({ pressed }) => [s.action, pressed && { backgroundColor: colors.leaveIconBackground }]}><Text style={s.actionText}>확인하기</Text><ArrowRight size={17} color={colors.leave} /></Pressable>
    </Animated.View>}
  </Animated.View>;
}
const s = StyleSheet.create({
  card: { width: '100%', maxWidth: layout.contentWidth, alignSelf: 'center', borderRadius: 25, borderWidth: 1, borderColor: colors.border, padding: 16, paddingBottom: 8, elevation: 8, boxShadow: '0 8px 24px rgba(25,55,35,0.16)' },
  close: { position: 'absolute', right: 3, top: 3, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, zIndex: 3 },
  title: { ...typography.body, fontWeight: '700', color: colors.text, paddingRight: 29, marginBottom: 13 },
  week: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', paddingTop: 3 },
  day: { flex: 1, minWidth: 0, alignItems: 'center', gap: 10, paddingVertical: 7, marginTop: -7, borderRadius: 18 }, weekday: { fontSize: 11, color: colors.secondary },
  today: { backgroundColor: colors.soft }, restSlot: { backgroundColor: colors.leaveIconBackground },
  spark: { position: 'absolute', right: -9, top: -10 },
  slot: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.track },
  melon: { width: 32, height: 32 }, reward: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  ticket: { width: 162, height: 118, borderRadius: 16, borderWidth: 2, borderColor: colors.leaveIconBackground, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] },
  notch: { position: 'absolute', top: 48, width: 17, height: 17, borderRadius: 9, backgroundColor: colors.leaveBackground }, amount: { fontSize: 62, lineHeight: 76, fontWeight: '700', color: colors.leave, letterSpacing: -3 },
  action: { minHeight: 44, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 20 }, actionText: { ...typography.link, color: colors.leave },
});
