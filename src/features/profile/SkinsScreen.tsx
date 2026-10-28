import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useIdentity } from '../../components/IdentityProvider';
import { useMemoryQuery } from '../../data/useMemoryQuery';
import { applyMySkin, getMySkins } from '../../data/skins';
import { memoryCache } from '../../data/query-cache';
import { toStudyError } from '../../lib/contracts';
import { studyRoomId } from '../../lib/room';
import { useStudy } from '../study/StudyProvider';
import { ui } from '../study/StudyUI';
import { useAndroidBack } from '../navigation/useAndroidBack';
import { SkinsView } from './SkinsView';

export function SkinsScreen() {
  const identity = useIdentity();
  const study = useStudy();
  const { data, loading, error, retry } = useMemoryQuery(['skins'], getMySkins, { staleTime: 10000 });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const updateProfile = identity.updateProfile;
  useEffect(() => { if (data) updateProfile(data.profile); }, [data, updateProfile]);
  function back() { if (lock.current) return; if (router.canGoBack()) router.back(); else router.replace('/profile'); }
  useAndroidBack(() => { back(); return true; });
  async function apply(id: string | null) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setFailure(''); setNotice('');
    try {
      const profile = await applyMySkin(id);
      updateProfile(profile);
      memoryCache.invalidate(key => { const [room, uid, kind] = JSON.parse(key); return room === studyRoomId && uid === identity.uid && kind === 'skins'; });
      retry(); void study.refresh();
      if (alive.current) setNotice(id ? '스킨을 적용했어요.' : '기본 모습으로 돌아왔어요.');
    } catch (e) { if (alive.current) setFailure(toStudyError(e).message); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <View style={ui.outer}><View style={ui.page}>{identity.profile && <SkinsView profile={identity.profile} skins={data?.skins ?? []} loading={loading} busy={busy} error={failure || error} notice={notice} onBack={back} onRetry={() => { setFailure(''); retry(); }} onApply={id => void apply(id)} />}</View></View>;
}
