import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AllowedAppsView } from '../src/features/allowed-apps/AllowedAppsView';
import { AllowedAppsSetup } from '../src/features/allowed-apps/AllowedAppsSetup';
import type { GuardStatus, studyGuard } from '../src/features/allowed-apps/native';
import { colors, typography } from '../src/design/theme';

type Stage = 'first' | 'usage' | 'notifications' | 'ready' | 'running';
const apps = [
  { packageName: 'example.dictionary', label: '영어 사전' },
  { packageName: 'example.calculator', label: '계산기' },
  { packageName: 'example.browser', label: '인터넷' },
  { packageName: 'example.notes', label: '노트' },
];
function AndroidSettings({ stage = 'first', width = 390, height = 844 }: { stage?: Stage; width?: number; height?: number }) {
  const [status, setStatus] = useState<GuardStatus>({
    running: stage === 'running', elapsedMs: 1500000,
    reason: stage === 'running' ? '스터디앱에서 측정 중' : '공부를 시작해 주세요',
    foreground: 'com.yumyumstudy.app', authorized: null,
    usageAccess: ['notifications', 'ready', 'running'].includes(stage),
    notificationAccess: ['ready', 'running'].includes(stage),
    restrictedSettingsReviewed: stage !== 'first', serviceAlive: stage === 'running',
    allowed: ['ready', 'running'].includes(stage) ? ['example.dictionary', 'example.calculator'] : [],
    events: [], pollMs: 500, link: null,
  });
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const change = (patch: Partial<GuardStatus>) => setStatus(previous => ({ ...previous, ...patch }));
  const select = (pkg: string, enabled: boolean) => change({ allowed: enabled ? [...status.allowed, pkg] : status.allowed.filter(value => value !== pkg) });
  const launch = async (pkg: string) => { change({ authorized: pkg, reason: '스터디앱에서 실행한 허용앱 사용 중' }); setMessage(`${apps.find(app => app.packageName === pkg)?.label} 실행 예시예요. 실제 앱은 열리지 않아요.`); };
  const guard: NonNullable<typeof studyGuard> = {
    status: async () => status, apps: async () => apps,
    openAppSettings: async () => setMessage('실제 APK에서는 앱 정보가 열려요. ⋮ → 제한된 설정 허용 후 돌아옵니다.'),
    reviewRestrictedSettings: async () => { change({ restrictedSettingsReviewed: true }); setMessage('제한된 설정 안내를 확인했어요. 다음은 사용정보 접근이에요.'); },
    openUsageSettings: async () => { change({ usageAccess: true }); setMessage('사용정보 접근을 허용하고 앱으로 돌아온 상태예요.'); },
    openNotificationSettings: async () => { change({ notificationAccess: true }); setMessage('알림을 허용하고 앱으로 돌아온 상태예요.'); },
    select: async allowed => change({ allowed }), launch,
    setTransport: async () => {}, prepareStudy: async () => {}, bindStudy: async () => {},
    recoverStoppedStudy: async () => {}, acknowledgeStop: async () => {},
    pause: async () => change({ running: false }), finish: async () => change({ running: false }), reset: async () => {},
  };
  const run = async (task: () => Promise<void>) => { await task(); };
  return <View style={{ gap: 12, alignItems: 'center', maxWidth: '100%' }}>
    <Text style={[typography.caption, { color: colors.secondary, maxWidth: width, textAlign: 'center' }]}>안드로이드 화면 미리보기 · 예시 데이터예요. 실제 권한과 공부 기록은 변경하지 않아요.</Text>
    <View style={{ width, height, maxWidth: '100%', borderWidth: 1, borderColor: colors.border, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 24, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between' }}><Text style={typography.caption}>9:41</Text><Text style={typography.caption}>Android</Text></View>
      <AllowedAppsView nativeAvailable status={status} apps={apps}
        setupContent={<AllowedAppsSetup status={status} busy={false} guard={guard} run={run} onEnableNotifications={guard.openNotificationSettings} />}
        error={message} busy={false} search={search} onSearch={setSearch} onBack={() => setMessage('마이페이지 또는 이전 화면으로 돌아가요.')}
        onSelect={select} />
    </View>
  </View>;
}
const meta = {
  id: 'android-allowed-apps', title: '화면/허용앱 설정 · Android', component: AndroidSettings,
  parameters: { screenLayout: true, layout: 'fullscreen', docs: { description: { component: '실제 앱과 동일한 AllowedAppsView / AllowedAppsSetup을 사용합니다. 권한 설정 버튼은 OS 설정을 여는 대신 상태만 변경하는 미리보기입니다. 설정 전 안내와 설정 후 허용앱 목록을 볼 수 있습니다. 공부 시작과 앱 실행은 홈·집중 화면에서 합니다.' } } },
  args: { stage: 'first', width: 390, height: 844 },
  argTypes: { stage: { control: 'select', options: ['first', 'usage', 'notifications', 'ready', 'running'] } },
  render: args => <AndroidSettings key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof AndroidSettings>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FirstSetup: Story = { name: '1 · 처음 설정 · 사용정보 접근' };
export const UsageAccess: Story = { name: '사용정보 접근 · 안내 확인 후', args: { stage: 'usage' } };
export const Notifications: Story = { name: '2 · 알림 허용', args: { stage: 'notifications' } };
export const Ready: Story = { name: '3 · 설정 완료 · 허용앱 선택', args: { stage: 'ready' } };
export const Running: Story = { name: '공부 중 · 설정 잠금', args: { stage: 'running' } };
export const SmallPhone: Story = { name: '작은 휴대폰 · 320px', args: { width: 320, height: 740 } };
