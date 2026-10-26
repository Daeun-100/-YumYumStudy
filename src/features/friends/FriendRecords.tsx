import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';
import { Button } from '../../design/components';
import { colors } from '../../design/theme';
import { getMemberHistory } from '../../data/study';
import { toStudyError, type DayRecord, type Snapshot, type RoomMember } from '../../lib/contracts';
import { RecordsPreview } from '../records/RecordsPreview';
import { OwnDayDetail } from '../records/OwnDayDetail';
import { weekStart } from '../records/model';
import { Nav, ui } from '../study/StudyUI';
import { useStudy } from '../study/StudyProvider';
import { displayedSeconds } from '../study/presentation';

export function FriendRecords({ member, onBack }: { member: RoomMember; onBack(): void }) {
  const study = useStudy();
  const today = member.today.studyDate;
  const [range, setRange] = useState({ from: weekStart(today), to: today });
  const [history, setHistory] = useState<Snapshot<DayRecord[]> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const changeRange = useCallback((from: string, to: string) => setRange(previous => previous.from === from && previous.to === to ? previous : { from, to }), []);
  useEffect(() => {
    let active = true;
    setLoading(true); setHistory(null); setError('');
    getMemberHistory(member.profile.id, range.from, range.to)
      .then(result => { if (active) setHistory(result); })
      .catch(failure => { if (active) setError(toStudyError(failure).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [member.profile.id, range, study.room, attempt]);
  const records = (history?.data ?? []).map(day => {
    const room = study.room;
    const useRoom = day.studyDate === today && room && Date.parse(room.serverNow) >= Date.parse(history!.serverNow);
    const source = useRoom ? member.today : day;
    const snapshotTime = useRoom ? room.serverNow : history!.serverNow;
    const now = study.roomError ? Date.parse(snapshotTime) : Math.max(study.now, Date.parse(snapshotTime));
    const seconds = displayedSeconds(source, member.activeSession, snapshotTime, now);
    return { date: day.studyDate, minutes: seconds / 60, goal: source.goalMinutes,
      status: source.attendance === 'leave' ? 'leave' as const : source.isRestDay ? 'rest' as const : seconds > 0 ? 'study' as const : 'empty' as const, sessions: [] };
  });
  const notice = <View style={{ gap: 8 }}>
    {loading && <ActivityIndicator color={colors.primary} accessibilityLabel="친구 기록 불러오는 중" />}
    {!!error && <><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Button label="다시 불러오기" onPress={() => setAttempt(value => value + 1)} /></>}
    {!!study.roomError && <Text accessibilityRole="alert" style={ui.muted}>연결 지연 · 마지막 확인한 기록이에요.</Text>}
    {!loading && !error && records.every(day => day.minutes === 0) && <Text style={ui.muted}>이 기간에는 공부 기록이 없어요.</Text>}
  </View>;
  return <View style={ui.outer}><View style={ui.page}>
    <RecordsPreview initialDate={today} today={today} records={records} onRangeChange={changeRange} profile={{ id: member.profile.id, name: member.profile.displayName, goal: member.today.goalMinutes, todayMinutes: member.today.closedSeconds / 60 }} onBack={onBack}
      notice={notice} loading={loading || !!error} renderDayDetail={day => <OwnDayDetail key={`${member.profile.id}:${day.date}`} day={day} member={member} room={study.room} />}
      refreshControl={<RefreshControl refreshing={loading} tintColor={colors.primary} onRefresh={() => { setAttempt(value => value + 1); void study.refresh(); }} />} />
    <Nav current="friends" />
  </View></View>;
}
