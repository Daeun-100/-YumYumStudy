import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';
import { Button } from '../../design/components';
import { colors } from '../../design/theme';
import { getHistory } from '../../data/study';
import { toStudyError, type DayRecord, type Snapshot } from '../../lib/contracts';
import { getStudyDate } from '../../lib/study-day';
import { Nav, ui } from '../study/StudyUI';
import { useStudy } from '../study/StudyProvider';
import { displayedSeconds } from '../study/presentation';
import { OwnDayDetail } from './OwnDayDetail';
import { RecordsPreview } from './RecordsPreview';
import { weekStart, type StudyRecord } from './model';

export function RecordsScreen() {
  const study = useStudy();
  const today = study.today?.data.day.studyDate ?? getStudyDate(Date.now());
  const [range, setRange] = useState({ from: weekStart(today), to: today });
  const [history, setHistory] = useState<Snapshot<DayRecord[]> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const changeRange = useCallback((from: string, to: string) => {
    setRange(previous => previous.from === from && previous.to === to ? previous : { from, to });
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    // A failed request must not leave another period's records on screen.
    setHistory(null);
    getHistory(range.from, range.to)
      .then(result => { if (active) setHistory(result); })
      .catch(failure => { if (active) setError(toStudyError(failure).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range, study.today, attempt]);
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
  const notice = <View style={{ gap: 8 }}>
    {loading && <ActivityIndicator color={colors.primary} accessibilityLabel="기록 불러오는 중" />}
    {!!error && <><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Button label="다시 불러오기" onPress={() => setAttempt(value => value + 1)} /></>}
    {!!study.error && <Text accessibilityRole="alert" style={ui.muted}>연결 지연 · 마지막 확인한 공부 시간이 표시돼요.</Text>}
    {!loading && !error && records.every(day => day.minutes === 0) && <Text style={ui.muted}>이 기간에는 공부 기록이 없어요.</Text>}
  </View>;
  return <View style={ui.outer}><View style={ui.page}>
    <RecordsPreview initialDate={today} today={today} records={records} onRangeChange={changeRange} notice={notice} loading={loading || !!error} renderDayDetail={day => <OwnDayDetail key={day.date} day={day} />}
      refreshControl={<RefreshControl refreshing={loading} tintColor={colors.primary} onRefresh={() => { setAttempt(value => value + 1); void study.refresh(); }} />} />
    <Nav current="records" />
  </View></View>;
}
