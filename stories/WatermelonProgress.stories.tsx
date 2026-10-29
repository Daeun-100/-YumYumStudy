import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Text, View } from 'react-native';
import { AchievementProgressIcon } from '../src/design/AchievementProgressIcon';
import { colors, spacing, typography } from '../src/design/theme';

const meta = {
  title: '공통 컴포넌트/수박 진행률', component: AchievementProgressIcon,
  args: { percent: 60, size: 48 },
  argTypes: {
    percent: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    size: { control: { type: 'range', min: 18, max: 64, step: 1 } },
  },
} satisfies Meta<typeof AchievementProgressIcon>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Adjustable: Story = { name: '채움 비율 조절' };
export const Stages: Story = {
  name: '크기와 달성률 비교',
  render: () => <View style={{ gap: spacing.xxl }}>
    {[18, 28, 48].map(size => <View key={size} style={{ gap: spacing.md }}>
      <Text style={{ ...typography.secondary, color: colors.secondary }}>{size}px</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
        {[0, 10, 25, 50, 75, 90, 100].map(percent => <View key={percent} style={{ minWidth: 44, alignItems: 'center', gap: spacing.sm }}>
          <AchievementProgressIcon percent={percent} size={size} />
          <Text style={{ ...typography.caption, color: colors.secondary }}>{percent}%</Text>
        </View>)}
      </View>
    </View>)}
  </View>,
};
