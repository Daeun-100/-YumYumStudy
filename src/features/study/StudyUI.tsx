import { ui } from './study-styles';
import { useSkinArtwork } from '../artwork/useSkinArtwork';
import { ArtworkImage } from '../artwork/ArtworkImage';
import { resolveCharacterArtwork as defaultArtwork } from '../../design/skin-artwork';
import { characters } from '../profile/CharacterPicker';
import type { CharacterId } from '../../lib/characters';
import { colors } from '../../design/theme';
import { AchievementBadge, Button } from '../../design/components';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useIdentity } from '../../components/IdentityProvider';
import { useStudy } from './StudyProvider';
import { progress } from './presentation';

export { ui } from './study-styles';

export function Avatar({ size = 64, character = 'bunny', activeSkinId }: { id?: string; size?: number; character?: CharacterId; activeSkinId?: string | null }) {
  const { resolveCharacterArtwork } = useSkinArtwork([activeSkinId]);
  return <ArtworkImage fallbackSource={defaultArtwork(character).home} source={resolveCharacterArtwork(character, activeSkinId).home} resizeMode="contain" style={{ width: size, height: size }} accessibilityLabel={`${characters[character].label} 캐릭터`} />;
}

export function Progress({ seconds, goal }: { seconds: number; goal: number | null }) {
  const value = progress(seconds, goal);
  return <View style={ui.progressRow}>
    <View accessibilityRole="progressbar" accessibilityLabel="오늘 목표 달성률" accessibilityValue={value === null ? { text: '목표 없음' } : { min: 0, max: 100, now: Math.min(value, 100), text: `목표 달성률 ${value}%` }} style={ui.track}>
      <View style={[ui.fill, { width: `${Math.min(value ?? 0, 100)}%` }]} />
    </View>{value !== null && value >= 100 && <AchievementBadge compact />}<Text style={ui.muted}>{value === null ? '—' : `${value}%`}</Text>
  </View>;
}
export function RoomArt({ tall = false }: { tall?: boolean }) {
  return <View style={{ height: tall ? 410 : 300, overflow: 'hidden', backgroundColor: colors.artFallback }}><Image source={require('../../../assets/illustrations/study-room-illustration.png')} resizeMode="cover" style={{ width: '100%', height: '100%' }} accessibilityLabel="따뜻한 공부방에서 함께 공부하는 동물 친구들" /></View>;
}
type TabKey = 'home' | 'records' | 'friends' | 'leave' | 'profile';
export function Page({ children, current }: PropsWithChildren<{ current?: TabKey }>) {
  const study = useStudy();
  return <View style={ui.outer}><View style={ui.page}><ScrollView contentContainerStyle={{ paddingBottom: 22 }} refreshControl={<RefreshControl refreshing={current === 'friends' ? study.roomLoading : study.loading} onRefresh={() => void (current === 'friends' ? study.refreshRoom() : study.refresh())} tintColor={colors.primary} />}><>{children}</></ScrollView></View></View>;
}
export function Status({ showLoading = true }: { showLoading?: boolean } = {}) {
  const identity = useIdentity(); const study = useStudy();
  const error = identity.error?.message ?? study.error;
  if (identity.loading || (!study.today && study.loading)) return !showLoading ? null : <View style={ui.status}><ActivityIndicator color={colors.primary} /><Text style={ui.muted}>공부방을 불러오고 있어요</Text></View>;
  if (!error) return null;
  return <View style={ui.status}><Text accessibilityRole="alert" style={ui.error}>{error}{study.actionFailed ? '\n처리 결과를 확인하지 못했어요. 같은 요청으로 다시 시도해 주세요.' : ''}</Text><Button label="다시 시도" variant="secondary" size="compact" disabled={study.busy} onPress={() => identity.error ? identity.retry() : study.actionFailed ? void study.toggle() : void study.refresh()} /></View>;
}
export function TimerButton({ large = false }: { large?: boolean }) {
  const s = useStudy(); const identity = useIdentity(); const running = !!s.today?.data.activeSession;
  return <Button accessibilityLabel={s.actionFailed ? '공부 요청 다시 시도' : running ? '공부 일시정지' : '공부 시작'}
    size={large ? 'round' : 'default'} loading={s.busy} disabled={!s.today || !!identity.error} onPress={() => void s.toggle()}
    label={`${s.actionFailed ? '↻' : running ? 'Ⅱ' : '▶'}${large ? '' : s.actionFailed ? ' 다시 시도' : running ? ' 일시정지' : ' 공부 시작'}`} />;
}
