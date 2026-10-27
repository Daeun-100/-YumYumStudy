import { recordQueryVersion } from '../../lib/record-query-version';
import { useScreenNow } from '../study/useScreenNow';
import { useMemoryQuery } from '../../data/useMemoryQuery';
import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { getDaySessions } from '../../data/record-sessions';
import { Button } from '../../design/components';
import { SkeletonRegion } from '../../design/Skeleton';
import { type Snapshot, type RoomMember } from '../../lib/contracts';
import { useStudy } from '../study/StudyProvider';
import { ui } from '../study/StudyUI';
import { DayDetail } from './RecordComponents';
import type { StudyRecord } from './model';
import { liveRecordMinutes, recordSessions } from './session-model';

export function OwnDayDetail({ day, member, room, summaryLoading = false }: { summaryLoading?: boolean; day: StudyRecord; member?: RoomMember; room?: Snapshot<RoomMember[]> | null }) {
  const study = useStudy();
  const current = member ? { day: member.today, activeSession: member.activeSession } : study.today?.data;
  const version = recordQueryVersion(current, day.date, day.date);
  const [initialNow] = useState(() => Date.now());
  const loadSessions = useCallback(() => { void version; return getDaySessions(day.date, member?.profile.id); }, [day.date, member?.profile.id, version]);
  const { data: sessions, error, loading, retry } = useMemoryQuery(['sessions', member?.profile.id ?? 'self', day.date], loadSessions, { version, staleTime: day.date < (current?.day?.studyDate ?? member?.today.studyDate ?? day.date) ? 300000 : 30000 });
  const snapshot = member ? room : study.today;
  const stale = member ? study.roomError : study.error;
  const activeSession = member ? member.activeSession : study.today?.data.activeSession;
  const currentDate = member ? member.today.studyDate : study.today?.data.day.studyDate;
  const ticking = !!activeSession && day.date === currentDate && !stale;
  const studyNow = useScreenNow(ticking);
  // Closed sessions are immutable between fetches; only running rows need clock work.
  const prepared = useMemo(() => (sessions ?? []).map(session => ({
    session,
    closed: session.endedAt ? recordSessions([session], day.date, initialNow) : null,
  })), [sessions, day.date, initialNow]);
  const now = snapshot ? stale ? Date.parse(snapshot.serverNow) : Math.max(studyNow, Date.parse(snapshot.serverNow)) : initialNow;
  const rows = prepared.flatMap(({ session, closed }) => closed ?? recordSessions([session], day.date, now));
  const minutes = liveRecordMinutes(day, now, ticking);
  return <View style={{ gap: 12, minHeight: 240 }}>
    <SkeletonRegion loading={summaryLoading || loading} label="상세 공부 기록 불러오는 중"><DayDetail day={{ ...day, minutes, sessions: rows }} aggregateOnly={sessions === undefined} /></SkeletonRegion>
    {!!error && <><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Button label="상세 기록 다시 불러오기" onPress={() => retry()} /></>}
    <Text style={ui.muted}>기록은 한국 시간 오전 6시부터 다음 날 오전 6시까지예요.</Text>
  </View>;
}
