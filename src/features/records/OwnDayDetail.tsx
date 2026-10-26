import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { getDaySessions } from '../../data/record-sessions';
import { Button } from '../../design/components';
import { colors } from '../../design/theme';
import { toStudyError, type StudySession, type Snapshot, type RoomMember } from '../../lib/contracts';
import { useStudy } from '../study/StudyProvider';
import { ui } from '../study/StudyUI';
import { DayDetail } from './RecordComponents';
import type { StudyRecord } from './model';
import { recordSessions } from './session-model';

export function OwnDayDetail({ day, member, room }: { day: StudyRecord; member?: RoomMember; room?: Snapshot<RoomMember[]> | null }) {
  const study = useStudy();
  const [sessions, setSessions] = useState<StudySession[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setSessions(null); setError('');
    getDaySessions(day.date, member?.profile.id).then(result => { if (active) setSessions(result); })
      .catch(failure => { if (active) setError(toStudyError(failure).message); });
    return () => { active = false; };
  }, [day.date, member?.profile.id, member ? room : study.today, attempt]);
  const snapshot = member ? room : study.today;
  const stale = member ? study.roomError : study.error;
  const now = snapshot ? stale ? Date.parse(snapshot.serverNow) : Math.max(study.now, Date.parse(snapshot.serverNow)) : Date.now();
  return <View style={{ gap: 12 }}>
    <DayDetail day={{ ...day, sessions: recordSessions(sessions ?? [], day.date, now) }} aggregateOnly={sessions === null} />
    {!sessions && !error && <ActivityIndicator color={colors.primary} accessibilityLabel="상세 공부 기록 불러오는 중" />}
    {!!error && <><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Button label="상세 기록 다시 불러오기" onPress={() => setAttempt(value => value + 1)} /></>}
    <Text style={ui.muted}>기록은 한국 시간 오전 6시부터 다음 날 오전 6시까지예요.</Text>
  </View>;
}
