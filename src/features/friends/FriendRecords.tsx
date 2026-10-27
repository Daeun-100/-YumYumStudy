import { useMemoryQuery } from '../../data/useMemoryQuery';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../design/components';
import { getMemberHistory } from '../../data/study';
import { type RoomMember } from '../../lib/contracts';
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
  const changeRange = useCallback((from: string, to: string) => setRange(previous => previous.from === from && previous.to === to ? previous : { from, to }), []);
  const roomVersion = study.room?.serverNow;
  const loadHistory = useCallback(() => {
    void roomVersion;
    return getMemberHistory(member.profile.id, range.from, range.to);
  }, [member.profile.id, range.from, range.to, roomVersion]);
  const { data: history, error, loading, retry } = useMemoryQuery(['member-history', member.profile.id, range.from, range.to], loadHistory);
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
  const notice = error ? <View style={{ gap: 8 }}>
    <Text accessibilityRole="alert" style={ui.error}>{error}</Text><Button label="다시 불러오기" onPress={() => retry()} />
  </View> : null;
  return <View style={ui.outer}><View style={ui.page}>
    <RecordsPreview initialDate={today} today={today} records={records} onRangeChange={changeRange} profile={{ id: member.profile.id, name: member.profile.displayName, goal: member.today.goalMinutes, todayMinutes: member.today.closedSeconds / 60 }} onBack={onBack}
      notice={notice} loading={loading} renderDayDetail={day => <OwnDayDetail key={`${member.profile.id}:${day.date}`} day={day} member={member} room={study.room} />}
      />
    <Nav current="friends" />
  </View></View>;
}
