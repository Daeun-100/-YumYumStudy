import { useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../design/theme';

const itemHeight = 44;
const hours = Array.from({ length: 25 }, (_, index) => index);
const minutes = [0, 30];

function Wheel({ label, values, value, onChange }: { label: string; values: number[]; value: number; onChange(value: number): void }) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scrolling = useRef(false);
  const change = useRef(onChange);
  change.current = onChange;
  const index = Math.max(0, values.indexOf(value));
  useEffect(() => {
    if (!scrolling.current) scroll.current?.scrollTo({ y: index * itemHeight, animated: false });
  }, [index]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return <View style={s.column}>
    <Text style={s.label}>{label}</Text>
    <View style={s.window}>
      <View pointerEvents="none" style={s.band} />
      <ScrollView ref={scroll} nestedScrollEnabled showsVerticalScrollIndicator={false}
        accessibilityLabel={`${label} 스크롤 선택`} snapToInterval={itemHeight} decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: itemHeight * 2 }}
        onLayout={() => scroll.current?.scrollTo({ y: index * itemHeight, animated: false })}
        scrollEventThrottle={16} onScroll={event => {
          const offset = event.nativeEvent.contentOffset.y;
          const next = Math.max(0, Math.min(values.length - 1, Math.round(offset / itemHeight)));
          scrolling.current = true;
          change.current(values[next]);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            scrolling.current = false;
            if (Math.abs(offset - next * itemHeight) > 0.5) scroll.current?.scrollTo({ y: next * itemHeight, animated: false });
          }, 150);
        }}>
        {values.map((number, position) => <Pressable key={number} accessibilityRole="button"
          accessibilityLabel={`${number}${label}`} accessibilityState={{ selected: value === number }}
          onPress={() => { clearTimeout(timer.current); scrolling.current = false; change.current(number); scroll.current?.scrollTo({ y: position * itemHeight, animated: false }); }}
          style={s.item}>
          <Text style={[s.number, { color: number === value ? colors.text : colors.inactiveLabel, fontWeight: number === value ? '700' : '400' }]}>{label === '분' ? String(number).padStart(2, '0') : number}</Text>
        </Pressable>)}
      </ScrollView>
    </View>
  </View>;
}

/** Snapping wheels share the same presentation on the phone and Storybook web preview. */
export function TimeWheelPicker({ value, onChange }: { value: number; onChange(value: number): void }) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  // Retain legacy minute values for the entire edit; never round an existing goal.
  const minuteValues = useRef([...minutes]);
  if (!minuteValues.current.includes(minute)) minuteValues.current = [...minuteValues.current, minute].sort((a, b) => a - b);
  return <View style={s.wheels}>
    <Wheel label="시간" values={hours} value={hour} onChange={next => onChange(next * 60 + (next === 24 ? 0 : minute))} />
    <Wheel label="분" values={hour === 24 ? [0] : minuteValues.current} value={minute} onChange={next => onChange(hour * 60 + next)} />
  </View>;
}
const s = StyleSheet.create({
  wheels: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xxl },
  column: { width: 100, gap: spacing.sm, alignItems: 'center' },
  label: { ...typography.secondary, color: colors.secondary },
  window: { height: itemHeight * 5, width: '100%', overflow: 'hidden' },
  band: { position: 'absolute', top: itemHeight * 2, height: itemHeight, left: 0, right: 0, borderRadius: 12, backgroundColor: colors.canvas },
  item: { height: itemHeight, alignItems: 'center', justifyContent: 'center' },
  number: { fontSize: 26, fontVariant: ['tabular-nums'] },
});
