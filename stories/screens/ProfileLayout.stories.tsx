import { characterIds } from '../../src/lib/characters';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { ProfileLayout } from './ProfileLayout';
const meta = {
  title: '화면 시안/나', component: ProfileLayout,
  parameters: { screenLayout: true, layout: 'fullscreen', docs: { description: { component: '카드 없이 프로필, 주간 달성 현황, 여백과 메뉴 목록으로 구성한 시안입니다. 프로필 이름 선택 → 이름 변경·저장·취소, 나 메인 → 목표 설정 → 요일별 시간·휴무 → 주간 미리보기 → 저장 흐름. 이용 안내와 앱 정보도 확인할 수 있어요. 저장은 스토리북 안에서만 유지되며 실제 앱이나 서버에 반영되지 않습니다. 시간은 30분 단위 휠 스크롤로 선택해요. 공통 TimeWheelPicker, SettingsRow, InfoNotice, WeeklyAchievement를 사용합니다.' } } },
  args: { character: 'bunny', initialScreen: 'home', initialPreview: false, width: 390, height: 844, name: '다이앤' },
  argTypes: { character: { control: 'select', options: characterIds }, initialScreen: { control: 'select', options: ['home', 'name', 'goals', 'guide', 'version'] }, initialDay: { control: 'select', options: [undefined, 0, 1, 2, 3, 4, 5, 6] }, width: { control: { type: 'range', min: 320, max: 430 } }, height: { control: { type: 'range', min: 640, max: 932 } } },
  render: args => <ProfileLayout key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof ProfileLayout>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Home: Story = { name: '나 · 메인' };
export const Goals: Story = { name: '목표 설정 · 요일별', args: { initialScreen: 'goals' } };
export const Time: Story = { name: '목표 설정 · 시간 선택', args: { initialScreen: 'goals', initialDay: 2 } };
export const Rest: Story = { name: '목표 설정 · 쉬는 날', args: { initialScreen: 'goals', initialDay: 6 } };
export const Preview: Story = { name: '목표 설정 · 주간 미리보기', args: { initialScreen: 'goals', initialPreview: true } };
export const Guide: Story = { name: '나 · 이용 안내', args: { initialScreen: 'guide' } };
export const Version: Story = { name: '나 · 앱 정보', args: { initialScreen: 'version' } };
export const Small: Story = { name: '나 · 작은 화면과 긴 이름', args: { width: 320, height: 740, name: '매일 조금씩 성장하는 다이앤' } };
export const SmallTime: Story = { name: '목표 설정 · 작은 화면 시간 선택', args: { initialScreen: 'goals', initialDay: 2, width: 320, height: 640 } };

export const EditName: Story = { name: '나 · 이름 변경', args: { initialScreen: 'name' } };
export const EditNameSmall: Story = { name: '나 · 이름 변경 작은 화면', args: { initialScreen: 'name', width: 320, height: 640 } };
