import { useAndroidBack } from '../navigation/useAndroidBack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRefreshOnResume } from '../../hooks/useRefreshOnResume';
import { router, useFocusEffect, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { getStudyDate } from '../../lib/study-day';
import { getGoalSettings, saveGoals } from '../../data/study';
import { useIdentity } from '../../components/IdentityProvider';
import { toStudyError, type GoalSettings, type GoalWeek, type Snapshot } from '../../lib/contracts';
import { useStudy } from '../study/StudyProvider';
import { Status, ui } from '../study/StudyUI';
import { mergeGoalDraft, sameGoals } from './model';
import { GoalsView } from './GoalsView';

type Editor = { snapshot: Snapshot<GoalSettings>; base: GoalWeek; draft: GoalWeek };
export default function GoalsScreen() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  const identity = useIdentity();
  const study = useStudy();
  const uid = identity.profile?.id;
  const [editor, setEditor] = useState<Editor | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const uncertainSave = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [discard, setDiscard] = useState(false);
  const blockedNavigation = useRef<(() => void) | null>(null);
  const busy = useRef(false);
  const sequence = useRef(0);
  const alive = useRef(true);
  const commit = useCallback((value: Editor) => { editorRef.current = value; setEditor(value); }, []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = useCallback(async () => {
    if (!uid || busy.current) return;
    const request = ++sequence.current;
    setLoading(true);
    try {
      const snapshot = await getGoalSettings();
      if (!alive.current || request !== sequence.current) return;
      const previous = editorRef.current;
      const base = snapshot.data.scheduled ?? snapshot.data.current;
      const draft = previous ? mergeGoalDraft(snapshot.data, previous.base, previous.draft) : [...base] as GoalWeek;
      commit({ snapshot, base, draft });
      if (uncertainSave.current && sameGoals(base, draft)) {
        uncertainSave.current = false; setSaveError(null);
        setNotice(snapshot.data.effectiveDate ? `저장된 목표를 확인했어요. ${snapshot.data.effectiveDate} 오전 6시부터 적용돼요.` : '저장된 목표를 확인했어요.');
      }
      setError(null);
    } catch (failure) { if (alive.current && request === sequence.current) setError(toStudyError(failure).message); }
    finally { if (alive.current && request === sequence.current) setLoading(false); }
  }, [uid, commit]);
  useFocusEffect(useCallback(() => { void load(); return () => { sequence.current++; }; }, [load]));
  useRefreshOnResume(load);
  const studyDate = study.today?.data.day.studyDate;
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [studyDate, load]);
  const back = () => {
    if (busy.current) return;
    if (router.canGoBack()) router.back(); else router.replace('/profile');
  };
  useAndroidBack(() => { back(); return true; });
  const dirty = !!editor && !sameGoals(editor.base, editor.draft);
  usePreventRemove(dirty || saving, ({ repeat }) => {
    if (busy.current) return;
    blockedNavigation.current = repeat; setDiscard(true);
  });
  async function save() {
    const submitted = editorRef.current;
    if (!submitted || busy.current || sameGoals(submitted.base, submitted.draft)) return;
    busy.current = true; setSaving(true); setError(null); setSaveError(null); setNotice(null); sequence.current++;
    try {
      // Re-read on every attempt; preserve other weekdays changed by another tab.
      const fresh = await getGoalSettings();
      const goals = mergeGoalDraft(fresh.data, submitted.base, submitted.draft);
      const result = await saveGoals(goals);
      if (!alive.current) return;
      const immediate = result.data.effectiveDate === getStudyDate(result.serverNow);
      commit({ snapshot: { serverNow: result.serverNow, data: immediate
        ? { isFirstSetup: false, current: result.data.goals, scheduled: null, effectiveDate: null }
        : { ...fresh.data, isFirstSetup: false, scheduled: result.data.goals, effectiveDate: result.data.effectiveDate } }, base: result.data.goals, draft: [...result.data.goals] as GoalWeek });
      uncertainSave.current = false;
      setNotice(immediate ? '저장했어요. 오늘 목표에 바로 적용했어요. 오늘 이미 공부한 시간도 포함돼요.' : `저장했어요. ${result.data.effectiveDate} 오전 6시부터 적용돼요.`);
      void study.refresh();
    } catch (failure) {
      if (alive.current) { uncertainSave.current = true; setSaveError(`${toStudyError(failure).message}\n입력한 목표는 유지했어요. 저장하기를 누르면 최신 설정을 확인하고 다시 반영해요.`); }
    } finally {
      busy.current = false;
      if (alive.current) { setSaving(false); setLoading(false); void load(); }
    }
  }
  return <View style={ui.outer}><View style={ui.page}>
    <GoalsView key={view ?? 'days'} initialPreview={view === 'preview'} isFirstSetup={editor?.snapshot.data.isFirstSetup} goals={editor?.draft ?? null} saved={editor?.base ?? null} current={editor?.snapshot.data.current} loading={loading} saving={saving}
      effectiveDate={editor?.snapshot.data.effectiveDate} error={saveError ?? error} notice={notice} status={<Status showLoading={false} />} discard={discard}
      onChange={draft => { if (!editorRef.current || busy.current) return; commit({ ...editorRef.current, draft }); setNotice(null); }}
      onSave={() => void save()} onRetry={() => void load()}
      onBack={back}
      onKeepEditing={() => { setDiscard(false); blockedNavigation.current = null; }}
      onDiscard={() => { if (editorRef.current) commit({ ...editorRef.current, draft: [...editorRef.current.base] as GoalWeek }); setDiscard(false); blockedNavigation.current?.(); blockedNavigation.current = null; }} />
  </View></View>;
}
