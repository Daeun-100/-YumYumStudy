import { CallFriendDialog } from '../call-friend/CallFriendDialog';
import { PostitOverlay } from '../postits/PostitOverlay';
import { useState } from 'react';
import { AllowedAppsLauncher } from '../allowed-apps/AllowedAppsLauncher';
import { useAndroidBack } from '../navigation/useAndroidBack';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useIdentity } from '../../components/IdentityProvider';
import { Button } from '../../design/components';
import { useStudy } from './StudyProvider';
import { Status, ui } from './StudyUI';
import { FocusView, type FocusMember } from './FocusView';
import { displayedSeconds, duration } from './presentation';

export function FocusScreen() {
  const [calledFriend, setCalledFriend] = useState<FocusMember | null>(null);
  const [allowedAppsOpen, setAllowedAppsOpen] = useState(false);
  useAndroidBack(() => { router.dismissTo('/'); return true; });
  const study = useStudy();
  const identity = useIdentity();
  const data = study.today?.data;
  const profile = identity.profile;
  const seconds = data && study.today ? displayedSeconds(data.day, data.activeSession, study.today.serverNow, study.now) : null;
  const sessionSeconds = data?.activeSession && study.today
    ? Math.max(0, Math.floor((Math.max(study.now, Date.parse(study.today.serverNow)) - Date.parse(data.activeSession.startedAt)) / 1000))
    : null;
  const members: FocusMember[] = profile ? [{ id: profile.id, name: profile.displayName, character: profile.character ?? 'bunny', time: '나', active: !!data?.activeSession, self: true }] : [];
  const friends = study.room?.data.filter(member => member.profile.id !== profile?.id).sort((a, b) => a.profile.id.localeCompare(b.profile.id)) ?? [];
  for (const member of friends) {
    const elapsed = displayedSeconds(member.today, member.activeSession, study.room!.serverNow, Math.max(study.now, Date.parse(study.room!.serverNow)));
    members.push({ id: member.profile.id, name: member.profile.displayName, character: member.profile.character ?? 'bunny', active: !!member.activeSession, time: duration(elapsed, false) });
  }
  return <View style={ui.outer}><View style={ui.page}>
    <FocusView onWake={setCalledFriend} renderRoomOverlay={scene => <PostitOverlay scene={scene} />} members={members} memberCount={study.room ? study.room.data.length : null} seconds={seconds} sessionSeconds={sessionSeconds} goalMinutes={data?.day.goalMinutes ?? null} running={!!data?.activeSession} busy={study.busy} disabled={!data || !!identity.error} retry={study.actionFailed} onBack={() => router.dismissTo('/')} onFriends={() => router.navigate('/friends')} onToggle={() => void study.toggle()} onAllowedApps={() => setAllowedAppsOpen(true)} />
    {calledFriend && <CallFriendDialog friend={calledFriend} onClose={() => setCalledFriend(null)} />}
    <AllowedAppsLauncher visible={allowedAppsOpen} onClose={() => setAllowedAppsOpen(false)} />
    <Status />
    {!!study.roomError && <View style={ui.status}><Text accessibilityRole="alert" style={ui.error}>{study.roomError}</Text><Button label="친구 현황 다시 불러오기" variant="secondary" size="compact" onPress={() => void study.refresh()} /></View>}
  </View></View>;
}
