import { useMemoryQuery } from '../../data/useMemoryQuery';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../design/components';
import { getHistory } from '../../data/study';
import { getStudyDate } from '../../lib/study-day';
import { Nav, ui } from '../study/StudyUI';
import { useStudy } from '../study/StudyProvider';
import { displayedSeconds } from '../study/presentation';
import { OwnDayDetail } from './OwnDayDetail';
import { RecordsPreview } from './RecordsPreview';
import { weekStart, type StudyRecord } from './model';

export function RecordsScreen() {
  const study = useStudy();
  const [initialNow] = useState(() => Date.now());
  const today = study.today?.data.day.studyDate ?? getStudyDate(initialNow);
  const [range, setRange] = useState({ from: weekStart(today), to: today });
  const changeRange = useCallback((from: string, to: string) => {
    setRange(previous => previous.from === from && previous.to === to ? previous : { from, to });
  }, []);
  const snapshotVersion = study.today?.serverNow;
  const loadHistory = useCallback(() => { void snapshotVersion; return getHistory(range.from, range.to); }, [range.from, range.to, snapshotVersion]);
  const { data: history, error, loading, retry } = useMemoryQuery(['history', range.from, range.to], loadHistory);
  const records: StudyRecord[] = (history?.data ?? []).map(day => {
    const current = study.today;
    const useCurrent = day.studyDate === today && current && Date.parse(current.serverNow) >= Date.parse(history!.serverNow);
    const source = useCurrent ? current.data.day : day;
    const snapshotTime = useCurrent ? current.serverNow : history!.serverNow;
    const now = study.error ? Date.parse(snapshotTime) : Math.max(study.now, Date.parse(snapshotTime));
    const seconds = displayedSeconds(source, current?.data.activeSession ?? null, snapshotTime, now);
    return { date: day.studyDate, minutes: seconds / 60, goal: source.goalMinutes,
      status: source.attendance === 'leave' ? 'leave' : source.isRestDay ? 'rest' : seconds > 0 ? 'study' : 'empty', sessions: [] };
  });
  const notice = error ? <View style={{ gap: 8 }}>
    <Text accessibilityRole="alert" style={ui.error}>{error}</Text><Button label="다시 불러오기" onPress={() => retry()} />
  </View> : null;
  return <View style={ui.outer}><View style={ui.page}>
    <RecordsPreview initialDate={today} today={today} records={records} onRangeChange={changeRange} notice={notice} loading={loading} renderDayDetail={day => <OwnDayDetail key={day.date} day={day} />}
      />
    <Nav current="records" />
  </View></View>;
}
