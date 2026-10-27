import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Text, View } from 'react-native';
import { colors, spacing, typography } from '../src/design/theme';

const candidates = [
  { name: '확정 · D1 핑크', color: colors.goal },
  { name: 'A · 밝은 핑크', color: '#FFADCA' },
  { name: 'B · 선명한 핑크', color: '#FF91BB' },
  { name: 'C · 로즈 핑크', color: '#FF9DAF' },
  { name: 'D · 수박 핑크', color: '#FF9B9F' },
  { name: 'E · 피치 핑크', color: '#FFAC9A' },
  { name: 'F · 라이트 핑크', color: '#FFC2D6' },
];
const detailedCandidates = [
  { name: 'D · 기준', color: '#FF9B9F' },
  { name: 'D1 · 조금 밝게', color: '#FFA3A6' },
  { name: 'D2 · 더 밝게', color: '#FFABAE' },
  { name: 'D3 · 조금 선명하게', color: '#FF9398' },
  { name: 'D4 · 더 선명하게', color: '#FF8B91' },
  { name: 'D5 · 살짝 따뜻하게', color: '#FF9F9B' },
  { name: 'D6 · 살짝 핑크 쪽으로', color: '#FF9BA7' },
];
function GoalColors({ detailed = false }: { detailed?: boolean }) {
  return <View style={{ width: '100%', maxWidth: 1000, gap: spacing.xxl }}>
    <View style={{ gap: spacing.sm }}><Text style={[typography.heading, { color: colors.text }]}>{detailed ? 'D안 · 세부 색상 비교' : '목표 시간 · 분홍색 비교'}</Text><Text style={[typography.secondary, { color: colors.secondary }]}>같은 초록색과 배경에서 색감과 막대의 구분을 비교해 보세요.</Text><Text style={[typography.caption, { color: colors.secondary }]}>공부 {colors.primary} · 배경 {colors.background} · 카드 {colors.surface}</Text></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>{(detailed ? detailedCandidates : candidates).map(item => <View key={item.name} style={{ flexBasis: 280, flexGrow: 1, backgroundColor: colors.background, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, gap: spacing.lg }}>
      <View><Text style={[typography.title, { color: colors.text }]}>{item.name}</Text><Text selectable style={[typography.caption, { color: colors.secondary }]}>{item.color}</Text></View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>{[{ color: item.color, label: '목표' }, { color: colors.primary, label: '공부' }, { color: colors.background, label: '배경' }].map(swatch => <View key={swatch.label} style={{ flex: 1, gap: spacing.xs }}><View style={{ height: 54, backgroundColor: swatch.color, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }} /><Text style={[typography.caption, { color: colors.secondary, textAlign: 'center' }]}>{swatch.label}</Text></View>)}</View>
      <View style={{ padding: spacing.md, backgroundColor: colors.surface, borderRadius: 16, gap: spacing.sm }}><View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 120 }}>{[0.35, 0.65, 1.15].map((ratio, i) => <View key={i} style={{ width: 40, height: 110, justifyContent: 'flex-end' }}><View style={{ position: 'absolute', bottom: 0, height: 90, width: '100%', backgroundColor: item.color, borderTopLeftRadius: 5, borderTopRightRadius: 5 }} /><View style={{ height: 90 * ratio, width: '100%', backgroundColor: colors.primary, borderTopLeftRadius: 5, borderTopRightRadius: 5 }} /></View>)}</View><View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>{['목표 미달', '목표 근접', '목표 초과'].map(label => <Text key={label} style={[typography.small, { color: colors.secondary }]}>{label}</Text>)}</View></View>
    </View>)}</View>
  </View>;
}
const meta = { title: '기본 스타일/목표 분홍색 비교', component: GoalColors, parameters: { screenLayout: true, layout: 'fullscreen' } } satisfies Meta<typeof GoalColors>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Comparison: Story = { name: '현재 색상과 후보 6개' };

export const DetailedD: Story = { name: 'D안 · 세부 베리에이션', args: { detailed: true } };
