import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { SharedPostits } from './SharedPostits';
const meta = {
  title: '화면 시안/공유 포스트잇', component: SharedPostits,
  parameters: { screenLayout: true, layout: 'fullscreen', docs: { description: { component: '실제 앱의 FocusView를 재사용한 공부방 위에 작은 포스트잇만 보이고, 누르면 내용을 읽어요. 반투명 붙이기 버튼과 간결한 종이형 내용 창을 사용합니다. ＋ 포스트잇 → 한마디 작성 → 원하는 위치를 눌러 붙이기. 오늘 작성한 포스트잇만 표시하며 작성자와 관계없이 누구나 내용 창에서 삭제할 수 있습니다. 어제 작성한 샘플은 숨깁니다. 스토리북 전용 시안이며 서버와 연결하지 않습니다.' } } },
  args: { width: 390, height: 844, empty: false, initialOpen: false, initialPlacement: false },
  render: args => <SharedPostits key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof SharedPostits>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Room: Story = { name: '공부방 · 작은 포스트잇' };
export const Reading: Story = { name: '포스트잇 · 내용 보기', args: { initialOpen: true } };
export const Placement: Story = { name: '포스트잇 · 위치 선택', args: { initialPlacement: true } };
export const Empty: Story = { name: '공부방 · 포스트잇 없음', args: { empty: true } };
export const Small: Story = { name: '공부방 · 작은 화면', args: { width: 320, height: 640 } };

export const BorderOnly: Story = { name: '공부방 · 테두리만 추가', args: { noteBorder: true }, parameters: { docs: { description: { story: '기존 크기·종이색·그림자는 그대로 두고, 작은 포스트잇에 짙은 갈색 1.5px 테두리만 추가한 시안입니다.' } } } };
