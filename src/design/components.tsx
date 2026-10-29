import { designAssets } from './assets';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PressableProps, StyleProp, ViewProps, ViewStyle } from 'react-native';
import { achievementTheme, segmentedTheme, buttonTheme, cardTheme, colors, interaction, radius, spacing, typography } from './theme';

// 사용 예: <Button label="공부 시작" onPress={start} />
// 배치만 style로 조절하고, 색상·크기·모서리는 theme.ts에서 변경합니다.
type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: 'primary' | 'secondary' | 'raised' | 'ghost';
  size?: 'default' | 'compact' | 'round' | 'icon';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};
export function Button({ label, variant = 'primary', size = 'default', loading = false, disabled = false, style, accessibilityState, ...props }: ButtonProps) {
  const unavailable = disabled || loading;
  const foreground = unavailable ? colors.disabledText : variant === 'primary' ? colors.onPrimary : variant === 'ghost' ? colors.text : colors.primary;
  return <Pressable {...props} accessibilityRole="button" disabled={unavailable}
    accessibilityState={{ ...accessibilityState, disabled: unavailable, busy: loading }}
    style={({ pressed }) => [styles.button, styles[variant], styles[size], variant === 'ghost' && { borderRadius: 12 }, style,
      unavailable ? { backgroundColor: variant === 'ghost' ? 'transparent' : colors.disabledSurface } : pressed ? { backgroundColor: variant === 'primary' ? colors.primaryPressed : colors.surfacePressed } : undefined]}>
    {loading ? <ActivityIndicator color={foreground} /> : <Text style={[size === 'round' ? typography.control : size === 'icon' ? typography.backIcon : variant === 'primary' ? typography.button : typography.link, { color: foreground, textAlign: 'center' }]}>{label}</Text>}
  </Pressable>;
}

/** Decorative info mark; the surrounding control or text supplies its label. */
export function InfoIcon({ tone = 'muted' }: { tone?: 'muted' | 'primary' }) {
  return <Text accessible={false} style={[styles.infoIcon, tone === 'primary' && { color: colors.primary }]}>ⓘ</Text>;
}

type InfoButtonProps = Omit<PressableProps, 'children' | 'accessibilityLabel'> & { accessibilityLabel: string };
export function InfoButton({ style, disabled, accessibilityState, ...props }: InfoButtonProps) {
  return <Pressable {...props} disabled={disabled} accessibilityRole="button"
    accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
    style={state => [styles.infoButton, typeof style === 'function' ? style(state) : style,
      disabled ? { opacity: 0.5 } : state.pressed && { backgroundColor: colors.surfacePressed }]}>
    <InfoIcon />
  </Pressable>;
}

type CardProps = ViewProps & { variant?: 'default' | 'compact' | 'panel' };
export function Card({ variant = 'default', style, ...props }: CardProps) {
  return <View {...props} style={[styles.card, variant === 'compact' && styles.compactCard, variant === 'panel' && styles.panel, style]} />;
}
export function PressableCard({ style, disabled, ...props }: PressableProps) {
  return <Pressable {...props} disabled={disabled} accessibilityRole="button"
    style={state => [styles.card, typeof style === 'function' ? style(state) : style,
      disabled ? { backgroundColor: colors.disabledSurface } : state.pressed ? { backgroundColor: colors.surfacePressed } : undefined]} />;
}
const styles = StyleSheet.create({
  infoIcon: { fontSize: 20, lineHeight: 26, color: colors.inactiveLabel, textAlign: 'center' },
  infoButton: { minWidth: interaction.minTouchSize, minHeight: interaction.minTouchSize, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  button: { alignItems: 'center', justifyContent: 'center', borderRadius: buttonTheme.radius },
  primary: { backgroundColor: colors.primary }, secondary: { backgroundColor: colors.soft }, raised: { backgroundColor: colors.raised }, ghost: { backgroundColor: 'transparent' },
  default: { minHeight: buttonTheme.height, paddingHorizontal: buttonTheme.horizontalPadding, paddingVertical: spacing.md },
  compact: { minWidth: buttonTheme.compactSize, minHeight: buttonTheme.compactSize, padding: spacing.md },
  icon: { width: buttonTheme.compactSize, height: buttonTheme.compactSize, borderRadius: radius.pill },
  round: { width: buttonTheme.roundSize, height: buttonTheme.roundSize, borderRadius: radius.pill },
  card: { backgroundColor: colors.surface, borderRadius: cardTheme.radius, padding: cardTheme.padding, borderWidth: cardTheme.borderWidth, borderColor: colors.border, gap: cardTheme.gap },
  compactCard: { padding: cardTheme.compactPadding },
  panel: { backgroundColor: colors.background, borderWidth: 0, borderRadius: 0, borderTopLeftRadius: radius.panel, borderTopRightRadius: radius.panel, padding: spacing.xxxl, gap: spacing.lg },
});

export function AchievementIcon({ size = achievementTheme.iconSize, superWatermelon = false }: { size?: number; superWatermelon?: boolean }) {
  return <Image source={superWatermelon ? designAssets.goldWatermelon : designAssets.watermelon} resizeMode="contain" accessibilityLabel={superWatermelon ? '슈퍼 수박 · 한 주 완주' : achievementTheme.label}
    style={{ width: size, height: size, flexShrink: 0 }} />;
}

export function AchievementBadge({ compact = false, superWatermelon = false, label = achievementTheme.label }: { compact?: boolean; label?: string; superWatermelon?: boolean }) {
  return <View accessible accessibilityLabel={label} style={{
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs,
    backgroundColor: achievementTheme.background, padding: compact ? 0 : spacing.sm, borderRadius: radius.pill,
  }}>
    <AchievementIcon superWatermelon={superWatermelon} size={compact ? achievementTheme.compactIconSize : achievementTheme.iconSize} />
    {!compact && <Text style={[typography.label, { color: achievementTheme.text }]}>{label}</Text>}
  </View>;
}

type SegmentOption<T extends string> = { value: T; label: string; disabled?: boolean };
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel, variant = 'soft' }: {
  options: readonly SegmentOption<T>[]; value: T; onChange(value: T): void; accessibilityLabel: string; variant?: 'soft' | 'filled';
}) {
  return <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={{ flexDirection: 'row', padding: spacing.xs, gap: spacing.xs, backgroundColor: segmentedTheme.background, borderRadius: segmentedTheme.radius }}>
    {options.map(option => <Pressable key={option.value} accessibilityRole="tab" disabled={option.disabled}
      accessibilityState={{ selected: value === option.value, disabled: !!option.disabled }} onPress={() => onChange(option.value)}
      style={({ pressed }) => ({ flex: 1, minHeight: interaction.minTouchSize, padding: spacing.sm, alignItems: 'center', justifyContent: 'center',
        borderRadius: segmentedTheme.radius, backgroundColor: option.disabled ? colors.disabledSurface : pressed ? colors.surfacePressed : value === option.value ? (variant === 'filled' ? colors.primary : segmentedTheme.selectedBackground) : segmentedTheme.background })}>
      <Text style={[typography.link, { color: option.disabled ? colors.disabledText : value === option.value ? (variant === 'filled' ? colors.onPrimary : segmentedTheme.selectedText) : segmentedTheme.text }]}>{option.label}</Text>
    </Pressable>)}
  </View>;
}
