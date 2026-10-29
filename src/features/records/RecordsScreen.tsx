import { useStudyResources } from '../study/study-resources';
import { recordQueryVersion } from '../../lib/record-query-version';
import { useScreenNow } from '../study/useScreenNow';
import { useMemoryQuery } from '../../data/useMemoryQuery';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../design/components';
import { getHistory } from '../../data/study';
import { getStudyDate } from '../../lib/study-day';
import { ui } from '../study/StudyUI';
import { useStudy } from '../study/StudyProvider';
import { displayedSeconds } from '../study/presentation';
import { OwnDayDetail } from './OwnDayDetail';
import { RecordsPreview } from './RecordsPreview';
import { weekStart, type StudyRecord } from './model';

export function RecordsScreen() {
  useStudyResources(['today']);
  const study = useStudy();
  const [initialNow] = useState(() => Date.now());
  const today = study.today?.data.day.studyDate ?? getStudyDate(initialNow);
  const [range, setRange] = useState({ from: weekStart(today), to: today });
  const studyNow = useScreenNow(!!study.today?.data.activeSession && range.from <= today && range.to >= today, 60000);
  const changeRange = useCallback((from: string, to: string) => {
    setRange(previous => previous.from === from && previous.to === to ? previous : { from, to });
  }, []);
  const snapshotVersion = recordQueryVersion(study.today?.data, range.from, range.to);
  const loadHistory = useCallback(() => { void snapshotVersion; return getHistory(range.from, range.to); }, [range.from, range.to, snapshotVersion]);
  const { data: history, error, loading, cached, retry } = useMemoryQuery(['history', range.from, range.to], loadHistory, { version: snapshotVersion, staleTime: range.to < today ? 300000 : 30000 });
  const records: StudyRecord[] = (history?.data ?? []).map(day => {
    const current = study.today;
    const useCurrent = day.studyDate === today && current && Date.parse(current.serverNow) >= Date.parse(history!.serverNow);
    const source = useCurrent ? current.data.day : day;
    const snapshotTime = useCurrent ? current.serverNow : history!.serverNow;
    const now = (cached && !useCurrent) || study.error ? Date.parse(snapshotTime) : Math.max(studyNow, Date.parse(snapshotTime));
    const seconds = displayedSeconds(source, current?.data.activeSession ?? null, snapshotTime, now);
    return { date: day.studyDate, superWatermelon: source.superWatermelon, asOf: now, minutes: seconds / 60, goal: source.goalMinutes,
      status: source.attendance === 'leave' ? 'leave' : source.isRestDay ? 'rest' : seconds > 0 ? 'study' : 'empty', sessions: [] };
  });
  const notice = error || cached ? <View style={{ gap: 8 }}>
    {cached && <Text style={ui.muted}>{error ? '저장된 기록이에요. 연결을 확인한 뒤 다시 불러와 주세요.' : '저장된 기록을 보여드리고 있어요. 최신 기록을 확인 중이에요.'}</Text>}
    {!!error && <><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Button label="다시 불러오기" onPress={() => retry()} /></>}
  </View> : null;
  return <View style={ui.outer}><View style={ui.page}>
    <RecordsPreview initialDate={today} today={today} records={records} onRangeChange={changeRange} notice={notice} loading={loading} renderDayDetail={(day, summaryLoading) => <OwnDayDetail summaryLoading={summaryLoading} key={day.date} day={day} />}
      />
  </View></View>;
}
