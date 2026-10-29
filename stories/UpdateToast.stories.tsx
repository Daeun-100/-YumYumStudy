import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { UpdateToastPreview } from './support/UpdateToastPreview';

const meta = {
  title: '공통 컴포넌트/토스트 · EAS 업데이트',
  component: UpdateToastPreview,
  parameters: {
    screenLayout: true,
    layout: 'fullscreen',
    docs: { description: { component: 'EAS OTA를 내려받아 적용할 준비가 된 상태의 외부 제어형 토스트 시안입니다. 자동으로 사라지지 않고, X 또는 호출 기능의 닫기 요청으로 종료합니다. 앱 기본 버전은 바뀌지 않으므로 새 APK 버전·다운로드 링크를 표시하지 않습니다. 버튼은 최신 develop의 마이페이지 이용 안내에 있는 앱 업데이트 · 적용하기 행으로 이동만 하며 OTA 적용·앱 다시 시작을 실행하지 않습니다. 목적지 표시 완료가 닫힘 조건입니다. 모든 작업은 모의 동작이며 실제 앱의 업데이트 경로에는 아직 연결하지 않았습니다.' } },
  },
  args: { width: 390, height: 844, initialError: false, failFirstAttempt: false, closeCondition: 'destination-ready' },
  argTypes: {
    closeCondition: { control: 'select', options: ['destination-ready', 'external-signal'], description: '호출 기능이 닫기를 요청할 시점' },
  },
  render: args => <UpdateToastPreview key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof UpdateToastPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = { name: '마이페이지로 안내 · 시간제한 없음' };
export const Small: Story = { name: '작은 화면 · 320px', args: { width: 320, height: 640 } };
export const NavigationFailure: Story = {
  name: '이동 실패 · 유지 후 재시도',
  args: { failFirstAttempt: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: '바로가기' }));
    await waitFor(() => expect(canvas.getByText('업데이트 위치로 이동하지 못했어요. 다시 시도해 주세요.')).toBeVisible(), { timeout: 4000 });
    await expect(canvas.getByTestId('update-toast')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: '업데이트 위치로 이동 다시 시도' }));
    await waitFor(() => expect(canvas.queryByTestId('update-toast')).not.toBeInTheDocument(), { timeout: 4000 });
    await expect(within(canvas.getByTestId('profile-update-section')).getByRole('button', { name: '적용하기' })).toBeEnabled();
  },
};
export const Error: Story = { name: '이동 실패 · 화면 확인', args: { initialError: true } };
export const ExternalCondition: Story = {
  name: '버튼과 닫힘 분리 · 외부 조건',
  args: { closeCondition: 'external-signal' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: '바로가기' }));
    await waitFor(() => expect(canvas.getByText('업데이트 영역이 표시될 때까지 기다리고 있어요.')).toBeVisible(), { timeout: 4000 });
    await expect(canvas.getByTestId('update-toast')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: '업데이트 영역 표시 완료 신호 보내기' }));
    await expect(canvas.queryByTestId('update-toast')).not.toBeInTheDocument();
    await expect(canvas.getByTestId('profile-update-section')).toBeVisible();
    await expect(within(canvas.getByTestId('profile-update-section')).getByRole('button', { name: '적용하기' })).toBeEnabled();
  },
};
export const ExternalConditionManual: Story = {
  name: '외부 조건 · 직접 조작', args: { closeCondition: 'external-signal' },
};
