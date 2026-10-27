import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../src/design/components';
import { colors, spacing, typography } from '../src/design/theme';
import { AllowedAppsView } from '../src/features/allowed-apps/AllowedAppsView';
import { AllowedAppsSetup } from '../src/features/allowed-apps/AllowedAppsSetup';
import { AllowedAppsLauncherView } from '../src/features/allowed-apps/AllowedAppsLauncherView';
import { sortAllowedApps } from '../src/features/allowed-apps/app-list';
import { createAllowedAppsSelectionQueue } from '../src/features/allowed-apps/selection-queue';
import type { GuardStatus, studyGuard } from '../src/features/allowed-apps/native';

// Offline image fixtures for layout review; production will need installed-app icons.
function icon(mark: string, background: string) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="22" fill="${background}"/><text x="48" y="62" text-anchor="middle" font-family="sans-serif" font-size="42" font-weight="700" fill="white">${mark}</text></svg>`)}`;
}
const fixtures = [
  { packageName: 'dictionary', label: '영어 사전', iconUri: icon('A', '#108363') },
  { packageName: 'camera', label: '카메라', iconUri: icon('◎', '#66716F') },
  { packageName: 'calculator', label: '계산기', iconUri: icon('±', '#226CB5') },
  { packageName: 'notes', label: '노트', iconUri: icon('N', '#A24A37') },
  { packageName: 'clock', label: '시계', iconUri: icon('◷', '#6F5339') },
  { packageName: 'browser', label: '인터넷', iconUri: icon('W', '#226CB5') },
  { packageName: 'translate', label: '번역', iconUri: icon('文', '#108363') },
  { packageName: 'pdf', label: 'PDF 리더', iconUri: icon('P', '#A24A37') },
  { packageName: 'flashcards', label: '암기 카드', iconUri: icon('K', '#6F5339') },
  { packageName: 'lecture', label: '온라인 강의', iconUri: icon('▶', '#226CB5') },
  { packageName: 'music', label: '음악', iconUri: icon('♪', '#108363') },
  { packageName: 'gallery', label: '갤러리', iconUri: icon('G', '#66716F') },
];
type Props = { screen: 'modal' | 'settings'; width: number; height: number; empty: boolean; missingIcons: boolean; running: boolean };
function AllowedAppsProposal({ screen, width, height, empty, missingIcons, running }: Props) {
  const [allowed, setAllowed] = useState<string[]>(empty ? [] : ['dictionary', 'calculator', 'notes', 'clock', 'browser', 'translate', 'pdf', 'flashcards', 'lecture']);
  const [selected, setSelected] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [current, setCurrent] = useState(screen);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const apps = fixtures.map(app => ({ ...app, iconUri: missingIcons ? null : app.iconUri }));
  const status: GuardStatus = { running, elapsedMs: 1500000, reason: '', foreground: '', authorized: null,
    usageAccess: true, notificationAccess: true, restrictedSettingsReviewed: true, serviceAlive: running,
    allowed, events: [], pollMs: 500, link: null };
  const statusRef = useRef(status);
  statusRef.current = status;
  const [pendingPackages, setPendingPackages] = useState<string[]>([]);
  const guard: NonNullable<typeof studyGuard> = {
    status: async () => statusRef.current, apps: async () => apps, select: async value => { await new Promise(resolve => setTimeout(resolve, 900)); statusRef.current = { ...statusRef.current, allowed: value }; },
    openAppSettings: async () => {}, reviewRestrictedSettings: async () => {}, openUsageSettings: async () => {}, openNotificationSettings: async () => {},
    setTransport: async () => {}, prepareStudy: async () => {}, bindStudy: async () => {}, recoverStoppedStudy: async () => {}, acknowledgeStop: async () => {}, pause: async () => {}, finish: async () => {}, reset: async () => {}, launch: async () => {},
  };
  const [selectionQueue] = useState(() => createAllowedAppsSelectionQueue(guard, {
    onPending: setPendingPackages, onStatus: next => setAllowed(next.allowed),
    onError: failure => setMessage(String(failure)),
  }));
  const select = (pkg: string, on: boolean) => { void selectionQueue.select(pkg, on); };
  return <View style={{ maxWidth: '100%', gap: spacing.md }}>
    <Text style={[typography.caption, { color: colors.secondary, maxWidth: width }]}>#9 · 실제 앱과 동일한 화면 · 아이콘 이미지만 예시 데이터예요.</Text>
    <View style={{ width, height, maxWidth: '100%', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 28, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 8 }}><Text style={typography.caption}>9:41</Text><Text style={typography.caption}>Android</Text></View>
      {current === 'modal' ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <Text style={typography.heading}>공부에 집중하는 중</Text><Text style={typography.timer}>00:25:00</Text>
        <Button label="허용앱" variant="secondary" onPress={() => setVisible(true)} />
      </View> : <AllowedAppsView nativeAvailable status={status} apps={apps}
        setupContent={<AllowedAppsSetup status={status} busy={false} guard={guard} run={async task => { await task(); }} onEnableNotifications={guard.openNotificationSettings} />}
        error={message} busy={false} pendingPackages={pendingPackages} search={search} onSearch={setSearch} onBack={() => { setCurrent('modal'); setVisible(true); }} onSelect={select} />}
      <AllowedAppsLauncherView embedded visible={current === 'modal' && visible} nativeAvailable needsSetup={false}
        apps={sortAllowedApps(apps.filter(app => allowed.includes(app.packageName)))} selected={selected} error={message}
        busy={false} studyBusy={false} hasSession onClose={() => setVisible(false)}
        onSettings={() => { setVisible(false); setCurrent('settings'); setMessage(''); }} onSelect={pkg => { setSelected(pkg); setMessage(''); }}
        onLaunch={pkg => setMessage(`${apps.find(app => app.packageName === pkg)?.label} 실행 예시예요. 실제 앱은 열리지 않아요.`)} />
    </View>
  </View>;
}
const meta = {
  title: '화면 시안/허용앱 가시성', component: AllowedAppsProposal,
  parameters: { screenLayout: true, docs: { description: { component: '이슈 #9. 실제 앱과 같은 AllowedAppsLauncherView / AllowedAppsView를 사용합니다. 모달은 40px 아이콘과 두 줄 이름을 3열로 표시해 9개 앱을 한눈에 보여주고, 마이페이지는 허용한 앱 우선·그룹 내 이름순입니다. 브라우저는 설치 앱에 접근할 수 없어 아이콘만 오프라인 예시 이미지입니다. 실제 저장이나 앱 실행은 하지 않습니다.' } } },
  args: { screen: 'modal', width: 390, height: 844, empty: false, missingIcons: false, running: false },
  argTypes: { screen: { control: 'select', options: ['modal', 'settings'] } },
  render: args => <AllowedAppsProposal key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof AllowedAppsProposal>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Modal: Story = { name: '모달 · 허용앱 9개 격자' };
export const Settings: Story = { name: '마이페이지 · 허용한 앱 먼저', args: { screen: 'settings' } };
export const SmallModal: Story = { name: '모달 · 작은 화면', args: { width: 320, height: 640 } };
export const SmallSettings: Story = { name: '마이페이지 · 작은 화면', args: { screen: 'settings', width: 320, height: 640 } };
export const Empty: Story = { name: '모달 · 등록한 앱 없음', args: { empty: true } };
export const MissingIcons: Story = { name: '모달 · 아이콘을 가져오지 못한 경우', args: { missingIcons: true } };
export const Running: Story = { name: '마이페이지 · 공부 중 변경 잠금', args: { screen: 'settings', running: true } };
