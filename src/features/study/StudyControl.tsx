import { StudyControlView } from './StudyControlView';
import { useIdentity } from '../../components/IdentityProvider';
import { useStudy } from './StudyProvider';

export function StudyControl({ round = false, roundSize = 72, onStarted }: { round?: boolean; roundSize?: 56 | 72; onStarted?(): void }) {
  const identity = useIdentity();
  const study = useStudy();
  const reload = !study.today || !!identity.error;
  const running = !!study.today?.data.activeSession;
  const busy = study.busy || (reload && (identity.loading || study.loading));
  async function press() {
    if (busy) return;
    if (reload) {
      if (identity.error || !identity.profile) identity.retry();
      else await study.refresh();
      return;
    }
    if (await study.toggle() && !running) onStarted?.();
  }
  return <StudyControlView round={round} roundSize={roundSize} reload={reload} busy={busy} running={running} onPress={() => void press()} />;
}
