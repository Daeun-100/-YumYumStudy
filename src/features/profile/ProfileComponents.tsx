import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AchievementIcon } from '../../design/components';
import { AchievementProgressIcon } from '../../design/AchievementProgressIcon';
import { colors, spacing, typography } from '../../design/theme';

/** Shared menu and weekday row: label, supporting text, value and disclosure. */
export function SettingsRow({ label, description, value, selected = false, icon, onPress }: {
  label: string; description?: string; value?: string; selected?: boolean; icon?: ReactNode; onPress(): void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={[label, description, value].filter(Boolean).join(', ')} onPress={onPress}
    style={({ pressed }) => [s.row, { borderRadius: selected || pressed ? 12 : 0, backgroundColor: pressed ? colors.surfacePressed : selected ? colors.soft : colors.background }]}>
    {icon && <View accessible={false} style={s.iconSlot}>{typeof icon === 'string' ? <Text style={s.icon}>{icon}</Text> : icon}</View>}<View style={{ flex: 1, gap: spacing.xs }}><Text style={[s.label, selected && { color: colors.primary }]}>{label}</Text>{description && <Text style={s.caption}>{description}</Text>}</View>
    {value && <Text style={[s.value, selected && { color: colors.primary }]}>{value}</Text>}<Text accessible={false} style={s.chevron}>›</Text>
  </Pressable>;
}
export function InfoNotice({ title, children }: { title?: string; children: string }) {
  return <View style={s.notice}>{title && <Text style={[typography.link, { color: colors.primary }]}>{title}</Text>}<Text style={s.caption}>{children}</Text></View>;
}
const s = StyleSheet.create({
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, paddingHorizontal: spacing.md },
  label: { ...typography.body, fontWeight: '600', color: colors.text },
  caption: { ...typography.secondary, color: colors.secondary },
  value: { ...typography.body, color: colors.secondary, flexShrink: 1, textAlign: 'right' },
  chevron: { fontSize: 26, color: colors.secondary },
  iconSlot: { width: 30, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 25, color: colors.primary, width: 30, textAlign: 'center' },
  notice: { paddingVertical: spacing.lg, paddingLeft: spacing.lg, borderLeftWidth: 2, borderLeftColor: colors.study, gap: spacing.sm },
});

/** Open weekly summary, without a container surface. Sample states supplied by the caller. */
export function WeeklyAchievement({ achievedDays = 4, achievedWeekdays, weekdayProgress }: { achievedDays?: number; achievedWeekdays?: readonly boolean[]; weekdayProgress?: readonly (number | null)[] }) {
  const days = Array.from({ length: 7 }, (_, index) => weekdayProgress ? (weekdayProgress[index] ?? 0) >= 100 : achievedWeekdays ? !!achievedWeekdays[index] : index < achievedDays);
  const count = days.filter(Boolean).length;
  return <View style={{ gap: spacing.lg, paddingVertical: spacing.xl }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Text style={[typography.link, { color: colors.text }]}>이번 주 목표 달성</Text>
      <Text style={[typography.title, { color: colors.primary }]}>{count}<Text style={[typography.secondary, { color: colors.secondary }]}> / 7일</Text></Text>
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {['월', '화', '수', '목', '금', '토', '일'].map((day, index) => <View key={day} accessible accessibilityLabel={`${day}요일 ${days[index] ? '목표 달성' : '미달성'}`} style={{ alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: days[index] ? colors.background : colors.track, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
          {weekdayProgress && (weekdayProgress[index] ?? 0) > 0 ? <AchievementProgressIcon percent={weekdayProgress[index]!} size={28} /> : days[index] && <AchievementIcon size={28} />}
        </View><Text style={[typography.caption, { color: colors.secondary }]}>{day}</Text>
      </View>)}
    </View>
    <Text style={[typography.caption, { color: colors.secondary }]}>{count >= 6 ? '이번 주 연차 획득 조건을 달성했어요.' : `6일을 달성하면 연차를 받아요. ${6 - count}일 더 함께해요.`}</Text>
  </View>;
}
