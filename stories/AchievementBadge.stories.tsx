import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { AchievementBadge } from '../src/design/components';
const meta = { title: '공통 컴포넌트/수박 배지', component: AchievementBadge, args: { compact: false }, argTypes: { compact: { control: 'boolean' } } } satisfies Meta<typeof AchievementBadge>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Label: Story = { name: '아이콘과 문구' };
export const Compact: Story = { name: '아이콘만', args: { compact: true } };
