import { HalloweenEvent } from '../events/HalloweenEvent';
import { useEventBackgrounds } from '../events/useEventBackgrounds';
import { useStudyResources } from './study-resources';
import { useScreenNow } from './useScreenNow';
import { StudyControl } from './StudyControl';
import { CallFriendDialog } from '../call-friend/CallFriendDialog';
import { PostitOverlay } from '../postits/PostitOverlay';
import { useState } from 'react';
import { AllowedAppsLauncher } from '../allowed-apps/AllowedAppsLauncher';
import { useAndroidBack } from '../navigation/useAndroidBack';
import { router, useIsFocused } from 'expo-router';
import { useIdentity } from '../../components/IdentityProvider';
import { useStudy } from './StudyProvider';
import type { FocusMember } from './FocusView';
import { FocusScreenView } from './FocusScreenView';
import { displayedSeconds, duration, progress } from './presentation';

export function FocusScreen() {
  useStudyResources(['today', 'room']);
  const focused = useIsFocused();
  const eventBackgrounds = useEventBackgrounds(focused);
  const [calledFriend, setCalledFriend] = useState<FocusMember | null>(null);
  const [allowedAppsOpen, setAllowedAppsOpen] = useState(false);
  useAndroidBack(() => { router.dismissTo('/'); return true; });
  const study = useStudy();
  const studyNow = useScreenNow();
  const identity = useIdentity();
  const data = study.today?.data;
  const profile = identity.profile;
  const seconds = data && study.today ? displayedSeconds(data.day, data.activeSession, study.today.serverNow, studyNow) : null;
  const sessionSeconds = data?.activeSession && study.today
    ? Math.max(0, Math.floor((Math.max(studyNow, Date.parse(study.today.serverNow)) - Date.parse(data.activeSession.startedAt)) / 1000))
    : null;
  const members: FocusMember[] = profile ? [{ id: profile.id, name: profile.displayName, character: profile.character ?? 'bunny', activeSkinId: profile.activeSkinId, time: '나', active: !!data?.activeSession, self: true }] : [];
  const friends = study.room?.data.filter(member => member.profile.id !== profile?.id).sort((a, b) => a.profile.id.localeCompare(b.profile.id)) ?? [];
  for (const member of friends) {
    const elapsed = displayedSeconds(member.today, member.activeSession, study.room!.serverNow, Math.max(studyNow, Date.parse(study.room!.serverNow)));
    const percent = progress(elapsed, member.today.goalMinutes);
    members.push({ id: member.profile.id, name: member.profile.displayName, character: member.profile.character ?? 'bunny', activeSkinId: member.profile.activeSkinId, active: !!member.activeSession, time: duration(elapsed, false), achieved: percent !== null && percent >= 100 });
  }
  return <FocusScreenView backgroundId={eventBackgrounds.focus} effectsEnabled={focused} onWake={setCalledFriend} renderRoomOverlay={scene => <><HalloweenEvent now={studyNow} focused={focused} studyDate={data?.day.studyDate} seconds={seconds} /><PostitOverlay scene={scene} /></>} members={members} memberCount={study.room ? study.room.data.length : null} seconds={seconds} sessionSeconds={sessionSeconds} goalMinutes={data?.day.goalMinutes ?? null} running={!!data?.activeSession} busy={study.busy} disabled={!data || !!identity.error} timerControl={<StudyControl round />} onBack={() => router.dismissTo('/')} onFriends={() => router.navigate('/friends')} onToggle={() => void study.toggle()} onAllowedApps={() => setAllowedAppsOpen(true)}>
    {calledFriend && <CallFriendDialog friend={calledFriend} onClose={() => setCalledFriend(null)} />}
    <AllowedAppsLauncher visible={allowedAppsOpen} onClose={() => setAllowedAppsOpen(false)} />

  </FocusScreenView>;
}
