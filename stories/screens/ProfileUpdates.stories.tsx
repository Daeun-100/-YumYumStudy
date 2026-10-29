import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View, Text } from 'react-native';
import { colors, typography } from '../../src/design/theme';
import { ProfileUpdates, type UpdatePreviewState } from './ProfileUpdates';

const meta = {
  title: '화면 시안/마이페이지 업데이트',
  component: ProfileUpdates,
  parameters: { layout: 'fullscreen', screenLayout: true, docs: { description: { component: '이용 안내의 앱 정보 위에 고정된 업데이트 항목입니다. 다운로드 후에도 직접 버튼을 눌러야 적용하며, 공부·저장 중에는 눌렀을 때만 짧은 안내를 표시합니다. 평소에는 한 줄과 행동 하나만 표시하고 행 높이를 유지합니다. 버튼은 스토리북의 가상 상태만 변경하며 실제 업데이트·재시작은 실행하지 않습니다. 공부·저장 중 안내는 공통 ToastProvider와 useToast의 본문 전용 토스트를 사용합니다.' } } },
  args: { initialState: 'ready', sectionOnly: false, width: 390, height: 844 },
  argTypes: { initialState: { control: 'select', options: ['latest', 'checking', 'downloading', 'ready', 'studying', 'saving', 'applying', 'error'] }, width: { control: { type: 'range', min: 320, max: 430 } } },
  render: args => <ProfileUpdates key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof ProfileUpdates>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = { name: '마이페이지 · 업데이트 적용 가능' };
export const UpdateSection: Story = { name: '메뉴 상세 · 눌러서 적용', args: { sectionOnly: true } };
export const Latest: Story = { name: '최신 상태', args: { initialState: 'latest', sectionOnly: true } };
export const Downloading: Story = { name: '다운로드 중 → 적용 대기', args: { initialState: 'downloading', sectionOnly: true } };
export const Studying: Story = { name: '눌렀을 때만 · 공부 중 안내', args: { initialState: 'studying', sectionOnly: true } };
export const Small: Story = { name: '작은 화면 · 320px', args: { width: 320, height: 640 } };
export const Compare: Story = {
  name: '상태 비교 · 같은 높이',
  render: () => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, padding: 12 }}>
    {([['latest', '최신 상태'], ['ready', '업데이트 준비됨'], ['applying', '처리 중']] as [UpdatePreviewState, string][]).map(([state, label]) => <View key={state} style={{ gap: 10 }}><Text style={{ ...typography.label, color: colors.text }}>{label}</Text><ProfileUpdates initialState={state} sectionOnly width={390} /></View>)}
  </View>,
};
