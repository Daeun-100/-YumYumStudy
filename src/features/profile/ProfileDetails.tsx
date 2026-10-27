import { useAndroidBack } from '../navigation/useAndroidBack';
import { useRef, useState, type PropsWithChildren } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useIdentity } from '../../components/IdentityProvider';
import { UpdateNotice } from '../../components/UpdateNotice';
import { saveProfile } from '../../data/profile';
import { Button } from '../../design/components';
import { spacing } from '../../design/theme';
import { toStudyError } from '../../lib/contracts';
import type { CharacterId } from '../../lib/characters';
import { useStudy } from '../study/StudyProvider';
import { ui } from '../study/StudyUI';
import { CharacterPicker } from './CharacterPicker';
import { NameEditor } from './NameEditor';
import config from '../../../app.json';

function back() { if (router.canGoBack()) router.back(); else router.replace('/profile'); }
function Detail({ title, children, busy = false }: PropsWithChildren<{ title: string; busy?: boolean }>) {
  useAndroidBack(() => { if (!busy) back(); return true; });
  return <View style={ui.outer}><View style={ui.page}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.xl }}><Button label="←" size="icon" variant="ghost" accessibilityLabel="마이페이지로 돌아가기" disabled={busy} onPress={back} /><Text accessibilityRole="header" style={ui.heading}>{title}</Text></View>
    {children}
  </View></View>;
}
export function ProfileEditScreen() {
  const identity = useIdentity();
  const study = useStudy();
  const [character, setCharacter] = useState<CharacterId>(identity.profile?.character ?? 'bunny');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function save(name: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const profile = await saveProfile(name, character);
      identity.updateProfile(profile);
      void study.refresh();
      back();
    } catch (failure) { setError(toStudyError(failure).message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Detail title="프로필 수정" busy={busy}><NameEditor name={identity.profile?.displayName ?? ''} changed={character !== (identity.profile?.character ?? 'bunny')} busy={busy} error={error} onSave={name => void save(name)} onCancel={back}>
    <CharacterPicker value={character} onChange={setCharacter} disabled={busy} />
  </NameEditor></Detail>;
}
const guides = [
  ['하루는 오전 6시에 시작해요', '공부 날짜는 한국 시간 오전 6시를 기준으로 바뀌어요. 새벽 공부는 오전 6시 전까지 전날 기록에 포함돼요.'],
  ['시작하고, 잠깐 쉬어가세요', '공부 시작을 누르면 시간이 쌓이고, 일시정지를 누르면 멈춰요. 공부한 시간은 기록에서 확인할 수 있어요.'],
  ['출석과 목표 달성', '공부한 날은 출석으로 기록해요. 설정한 목표 시간 이상 공부하면 목표 달성이에요. 쉬는 날은 목표 달성률을 표시하지 않아요.'],
  ['연차 획득과 사용', '무료 연차는 매주 월요일 오전 6시에 1개 받아요. 한 주에 목표를 6일 달성하면 보상 연차 1개를 얻어요. 휴무·미설정·연차 사용일은 보상 인정 일수에서 제외돼요. 연차는 오늘 공부 날짜에 바로 쓰거나 미래 날짜에 예약할 수 있어요. 오늘 사용하면 취소·변경할 수 없고, 미래 예약은 사용일 오전 6시 전까지 취소·변경할 수 있어요. 이미 획득한 보상의 인정 일수가 6일 미만이 되면 오늘은 사용할 수 없어요.'],
  ['연차 만료', '무료 연차는 다음 월요일 오전 6시에 만료되고 이월되지 않아요. 보상 연차는 획득 주 시작일로부터 21일 뒤 오전 6시에 만료돼요. 정확한 만료일과 예약 상태는 연차 탭에서 확인해 주세요.'],
  ['기기를 바꾸거나 저장소를 지울 때', '현재 기기의 사용자 정보가 사라지면 기존 기록에 다시 접근하지 못할 수 있어요. 기기 변경이나 앱 데이터 삭제 전에 보관 방법을 확인해 주세요.'],
];
export function ProfileGuideScreen() {
  return <Detail title="이용 안내"><ScrollView contentContainerStyle={{ padding: spacing.xxl, gap: spacing.xxl }}>
    <Text style={ui.muted}>함께 공부하기 전에 알아두면 좋아요.</Text>
    {guides.map(([title, body]) => <View key={title} style={{ gap: spacing.md }}><Text style={ui.title}>{title}</Text><Text style={ui.muted}>{body}</Text></View>)}
  </ScrollView></Detail>;
}
export function ProfileInfoScreen() {
  return <Detail title="앱 정보"><ScrollView contentContainerStyle={{ padding: spacing.xxl, gap: spacing.lg, alignItems: 'center' }}>
    <Text style={ui.title}>냠냠스터디</Text><Text style={ui.heading}>{config.expo.version}</Text><Text style={ui.muted}>설치된 앱 버전</Text><UpdateNotice />
  </ScrollView></Detail>;
}
