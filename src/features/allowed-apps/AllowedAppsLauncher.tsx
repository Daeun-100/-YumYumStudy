import { withTimeout } from '../../lib/with-timeout';
import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { AllowedAppsLauncherView } from './AllowedAppsLauncherView';
import { sortAllowedApps } from './app-list';
import { useStudy } from '../study/StudyProvider';
import { studyGuard, type GuardApp } from './native';

export function AllowedAppsLauncher({ visible, onClose }: { visible: boolean; onClose(): void }) {
  const study = useStudy();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [apps, setApps] = useState<GuardApp[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  useEffect(() => {
    if (!visible || !studyGuard) return;
    let current = true;
    void Promise.all([withTimeout(studyGuard.status(), 5000, '허용앱 설정 확인 지연'), withTimeout(studyGuard.apps(), 5000, '허용앱 목록 확인 지연')]).then(([status, installed]) => {
      if (current) {
        setNeedsSetup(!status.usageAccess || !status.notificationAccess);
        const allowed = sortAllowedApps(installed.filter(app => status.allowed.includes(app.packageName)));
        setApps(allowed);
        setSelected(previous => allowed.some(app => app.packageName === previous) ? previous : allowed.length === 1 ? allowed[0].packageName : null);
        setError('');
      }
    }).catch(() => { if (current) setError('허용앱 목록을 불러오지 못했어요. 설정에서 다시 확인해 주세요.'); });
    return () => { current = false; };
  }, [visible]);
  async function launch(packageName: string) {
    if (!studyGuard || locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await withTimeout(studyGuard.launch(packageName), 5000, '허용앱 실행이 지연되고 있어요. 다시 시도해 주세요.'); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '앱을 실행하지 못했어요.'); }
    finally { locked.current = false; setBusy(false); }
  }
  const settings = () => { onClose(); router.navigate('/allowed-apps'); };
  return <AllowedAppsLauncherView visible={visible} nativeAvailable={!!studyGuard} needsSetup={needsSetup}
    apps={apps} selected={selected} error={error} busy={busy} studyBusy={study.busy}
    hasSession={!!study.today?.data.activeSession} onClose={onClose} onSettings={settings}
    onSelect={setSelected} onLaunch={pkg => void launch(pkg)} />;
}
