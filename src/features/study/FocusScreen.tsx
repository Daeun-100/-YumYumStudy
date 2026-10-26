import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useIdentity } from '../../components/IdentityProvider';
import { Button } from '../../design/components';
import { useStudy } from './StudyProvider';
import { Status, ui } from './StudyUI';
import { FocusView, type FocusMember } from './FocusView';
import { displayedSeconds, duration } from './presentation';

export function FocusScreen() {
  const study = useStudy();
  const identity = useIdentity();
  const data = study.today?.data;
  const profile = identity.profile;
  const seconds = data && study.today ? displayedSeconds(data.day, data.activeSession, study.today.serverNow, study.now) : null;
  const members: FocusMember[] = profile ? [{ id: profile.id, name: profile.displayName, character: profile.character ?? 'bunny', time: '나', active: !!data?.activeSession, self: true }] : [];
  const friends = study.room?.data.filter(member => member.profile.id !== profile?.id).sort((a, b) => a.profile.id.localeCompare(b.profile.id)) ?? [];
  for (const member of friends) {
    const elapsed = displayedSeconds(member.today, member.activeSession, study.room!.serverNow, Math.max(study.now, Date.parse(study.room!.serverNow)));
    members.push({ id: member.profile.id, name: member.profile.displayName, character: member.profile.character ?? 'bunny', active: !!member.activeSession, time: duration(elapsed, false) });
  }
  return <View style={ui.outer}><View style={ui.page}>
    <FocusView members={members} memberCount={study.room ? study.room.data.length : null} seconds={seconds} goalMinutes={data?.day.goalMinutes ?? null} running={!!data?.activeSession} busy={study.busy} disabled={!data || !!identity.error} retry={study.actionFailed} onBack={() => router.navigate('/')} onFriends={() => router.navigate('/friends')} onToggle={() => void study.toggle()} />
    <Status />
    {!!study.roomError && <View style={ui.status}><Text accessibilityRole="alert" style={ui.error}>{study.roomError}</Text><Button label="친구 현황 다시 불러오기" variant="secondary" size="compact" onPress={() => void study.refresh()} /></View>}
  </View></View>;
}
