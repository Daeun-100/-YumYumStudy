import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Smartphone } from 'lucide-react-native';
import { Button, InfoIcon } from '../src/design/components';
import { colors, typography } from '../src/design/theme';
import { SettingsRow, WeeklyAchievement } from '../src/features/profile/ProfileComponents';
import { ProfileIdentity } from '../src/features/profile/ProfileIdentity';
import { SkinsView } from '../src/features/profile/SkinsView';
import type { Profile } from '../src/lib/contracts';
import type { OwnedSkin } from '../src/lib/skins';
import config from '../app.json';

const fixtures: OwnedSkin[] = [
  { id: 'bunny-toothache', name: '치통 토끼', character: 'bunny', grantedAt: '2026-10-28T00:00:00Z' },
  { id: 'bear-future', name: '축하받는 곰', character: 'bear', grantedAt: '2026-10-28T01:00:00Z' },
];
type Props = { initialScreen: 'profile' | 'skins'; initialSelection: string; state: 'ready' | 'empty' | 'error' | 'unsupported'; width: number };
function CharacterSkins({ initialScreen, initialSelection, state, width }: Props) {
  const [screen, setScreen] = useState(initialScreen);
  const [profile, setProfile] = useState<Profile>({ id: 'sample', displayName: '다이앤', character: 'bear', activeSkinId: null });
  const [failed, setFailed] = useState(state === 'error');
  const [notice, setNotice] = useState('');
  const [notifications, setNotifications] = useState(false);
  const skins = state === 'empty' ? [] : state === 'unsupported' ? fixtures : fixtures.slice(0, 1);
  function apply(id: string | null) {
    const choice = skins.find(skin => skin.id === id);
    setProfile(value => ({ ...value, character: choice?.character ?? value.character, activeSkinId: id }));
    setNotice(id ? '스킨을 적용했어요.' : '기본 모습으로 돌아왔어요.');
  }
  const rule = <View style={{ height: 1, backgroundColor: colors.track }} />;
  const eyebrow = { ...typography.label, color: colors.secondary, paddingTop: 8 };
  return <View style={{ width, maxWidth: '100%', height: 844, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.track, borderRadius: 32, overflow: 'hidden' }}>
    <View style={{ height: 42, paddingHorizontal: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={typography.caption}>9:41</Text><Text style={typography.caption}>● ● ▰</Text></View>
    {screen === 'skins' ? <SkinsView profile={profile} skins={failed ? [] : skins} initialSelectedId={initialSelection || undefined} error={failed ? '스킨을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.' : ''} notice={notice} onBack={() => { setScreen('profile'); setNotice(''); }} onRetry={() => setFailed(false)} onApply={apply} /> : <>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32, gap: 16 }}>
        <Text accessibilityRole="header" style={{ ...typography.heading, color: colors.text }}>다이앤님</Text>
        <ProfileIdentity profile={profile} count={skins.length} onEdit={() => setNotice('프로필 수정은 실제 앱에서 사용할 수 있어요.')} onSkins={() => { setScreen('skins'); setNotice(''); }} />
        {rule}<WeeklyAchievement achievedDays={4} />{rule}
        <View style={{ gap: 8 }}><Text style={eyebrow}>나의 공부</Text><SettingsRow icon="◎" label="공부 목표 설정" value="주 18시간" onPress={() => setNotice('공부 목표 설정은 실제 앱에서 사용할 수 있어요.')} /><SettingsRow icon={<Smartphone size={20} strokeWidth={1.8} color={colors.primary} />} label="허용앱 설정" onPress={() => setNotice('허용앱 설정은 Android 앱에서 사용할 수 있어요.')} /></View>
        <View style={{ gap: 10, paddingVertical: 12 }}><Text style={{ ...typography.label, color: colors.text }}>친구 부르기 알림</Text><Text style={{ ...typography.secondary, color: colors.secondary }}>친구가 부르면 메시지를 받아요. iPhone은 홈 화면에 추가한 앱에서 켤 수 있어요.</Text><Button label={notifications ? '부르기 알림 끄기' : '부르기 알림 켜기'} variant="secondary" onPress={() => setNotifications(!notifications)} /></View>
        {rule}<View style={{ gap: 8 }}><Text style={eyebrow}>이용 안내</Text><SettingsRow icon={<InfoIcon tone="primary" />} label="공부와 연차 이용 안내" onPress={() => setNotice('이용 안내는 실제 앱에서 확인할 수 있어요.')} /><SettingsRow icon="↗" label="앱 정보" value={config.expo.version} onPress={() => setNotice(`얌얌스터디 ${config.expo.version}`)} /></View>
      </ScrollView>
      {!!notice && <Text accessibilityLiveRegion="polite" style={{ padding: 16, color: colors.primary }}>{notice}</Text>}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 18, borderTopWidth: 1, borderColor: colors.track }}>{['홈','집중','연차','기록','나'].map(tab => <Text key={tab} style={{ ...typography.secondary, color: tab === '나' ? colors.primary : colors.secondary }}>{tab}</Text>)}</View>
    </>}
    <View style={{ height: 22, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 120, height: 4, borderRadius: 2, backgroundColor: colors.text }} /></View>
  </View>;
}
const meta = { title: '화면/캐릭터 스킨', component: CharacterSkins, parameters: { screenLayout: true, docs: { description: { component: '실제 앱과 ProfileIdentity·SkinsView를 공유합니다. 치통 토끼는 실제 포함 이미지이고, 업데이트 필요 예시는 앱에 없는 스킨입니다. 스토리북 선택은 서버에 저장하지 않습니다.' } } }, args: { initialScreen: 'profile', initialSelection: '', state: 'ready', width: 390 } } satisfies Meta<typeof CharacterSkins>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ProfileEntry: Story = { name: '프로필 · 보유 스킨 진입' };
export const Collection: Story = { name: '보유 스킨 · 목록과 적용', args: { initialScreen: 'skins' } };
export const CrossCharacter: Story = { name: '다른 캐릭터 · 변경하고 적용', args: { initialScreen: 'skins', initialSelection: 'bunny-toothache' } };
export const NoGifts: Story = { name: '선물 받은 스킨 없음', args: { initialScreen: 'skins', state: 'empty' } };
export const LoadError: Story = { name: '불러오기 실패 · 재시도', args: { initialScreen: 'skins', state: 'error' } };
export const UpdateRequired: Story = { name: '새 스킨 · 업데이트 필요', args: { initialScreen: 'skins', state: 'unsupported' } };
export const SmallPhone: Story = { name: '작은 화면 · 320px', args: { initialScreen: 'skins', width: 320, initialSelection: 'bunny-toothache' } };
