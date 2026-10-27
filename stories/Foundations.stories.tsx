import { AchievementIcon } from '../src/design/components';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Text, View } from 'react-native';
import { colors, spacing, typography } from '../src/design/theme';
const meta = { title: '기본 스타일/디자인 토큰' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const Colors: Story = { name: '색상', render: () => <View style={{ gap: spacing.md }}><Text style={[typography.title, { color: colors.text }]}>불투명 색상 팔레트</Text>{Object.entries(colors).map(([name, color]) => <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}><View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: color, borderWidth: 1, borderColor: colors.border }} /><View><Text style={[typography.body, { color: colors.text }]}>{name}</Text><Text style={[typography.caption, { color: colors.secondary }]}>{color}</Text></View></View>)}</View> };
export const Typography: Story = { name: '글자 크기', render: () => <View style={{ gap: spacing.xxl }}>{Object.entries(typography).map(([name, style]) => <View key={name} style={{ gap: spacing.xs }}><Text style={[typography.caption, { color: colors.secondary }]}>{name} · {style.fontSize}px</Text><Text style={[style, { color: colors.text }]}>{name === 'timer' ? '01:20:15' : name === 'metric' ? '1시간 20분' : '함께 쌓는 공부 시간'}</Text></View>)}</View> };

export const StatusPalette: Story = {
  name: '목표 · 공부 · 연차 색상',
  render: () => <View style={{ gap: spacing.lg }}>
    <Text style={[typography.title, { color: colors.text }]}>기록 화면의 색감</Text>
    <Text style={[typography.secondary, { color: colors.secondary }]}>밝은 배경 위에 상태별 색상을 배치한 예시예요. 모든 표면은 불투명 단색입니다.</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      {[
        { label: '목표 달성', icon: 'achievement', background: colors.soft, foreground: colors.primary },
        { label: '목표 시간', icon: '●', background: colors.goal, foreground: colors.text },
        { label: '공부함', icon: '●', background: colors.soft, foreground: colors.study },
        { label: '연차 사용', icon: '✈', background: colors.leaveBackground, foreground: colors.leave },
        { label: '기록 없음', icon: '—', background: colors.emptyBackground, foreground: colors.secondary },
        { label: '쉬는 날', icon: '휴무', background: colors.restBackground, foreground: colors.secondary },
      ].map(item => <View key={item.label} style={{ minWidth: 120, flexGrow: 1, padding: spacing.lg, gap: spacing.sm, borderRadius: 16, backgroundColor: item.background }}>
        {item.icon === 'achievement' ? <AchievementIcon /> : <Text style={[typography.title, { color: item.foreground }]}>{item.icon}</Text>}
        <Text style={[typography.caption, { color: colors.text }]}>{item.label}</Text>
      </View>)}
    </View>
    <View style={{ backgroundColor: colors.primary, padding: spacing.lg, borderRadius: 16 }}><Text style={[typography.button, { color: colors.onPrimary, textAlign: 'center' }]}>초록색 강조</Text></View>
  </View>,
};
