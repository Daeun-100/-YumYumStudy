import { useMemoryQuery } from '../../data/useMemoryQuery';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { getDaySessions } from '../../data/record-sessions';
import { Button } from '../../design/components';
import { SkeletonRegion } from '../../design/Skeleton';
import { type Snapshot, type RoomMember } from '../../lib/contracts';
import { useStudy } from '../study/StudyProvider';
import { ui } from '../study/StudyUI';
import { DayDetail } from './RecordComponents';
import type { StudyRecord } from './model';
import { recordSessions } from './session-model';

export function OwnDayDetail({ day, member, room }: { day: StudyRecord; member?: RoomMember; room?: Snapshot<RoomMember[]> | null }) {
  const study = useStudy();
  const refreshSnapshot = member ? room : study.today;
  const [initialNow] = useState(() => Date.now());
  const loadSessions = useCallback(() => { void refreshSnapshot; return getDaySessions(day.date, member?.profile.id); }, [day.date, member?.profile.id, refreshSnapshot]);
  const { data: sessions, error, loading, retry } = useMemoryQuery(['sessions', member?.profile.id ?? 'self', day.date], loadSessions);
  const snapshot = member ? room : study.today;
  const stale = member ? study.roomError : study.error;
  const now = snapshot ? stale ? Date.parse(snapshot.serverNow) : Math.max(study.now, Date.parse(snapshot.serverNow)) : initialNow;
  return <View style={{ gap: 12, minHeight: 240 }}>
    <SkeletonRegion loading={loading} label="상세 공부 기록 불러오는 중"><DayDetail day={{ ...day, sessions: recordSessions(sessions ?? [], day.date, now) }} aggregateOnly={sessions === undefined} /></SkeletonRegion>
    {!!error && <><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Button label="상세 기록 다시 불러오기" onPress={() => retry()} /></>}
    <Text style={ui.muted}>기록은 한국 시간 오전 6시부터 다음 날 오전 6시까지예요.</Text>
  </View>;
}
