import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '../../design/components';
import { colors, spacing, typography } from '../../design/theme';
import type { studyGuard, GuardStatus } from './native';
import { allowedAppsSetup } from './setup';

type Props = {
  status: GuardStatus | null; busy: boolean; guard: NonNullable<typeof studyGuard>;
  run(task: () => Promise<void>): Promise<void>; onEnableNotifications(): Promise<void>;
};
export function AllowedAppsSetup({ status, busy, guard, run, onEnableNotifications }: Props) {
  const setup = allowedAppsSetup(status);
  const [expanded, setExpanded] = useState(false);
  const [restrictedHelp, setRestrictedHelp] = useState(false);
  const disabled = busy || !status || status.running;
  const current = !setup.usage ? 0 : !setup.notifications ? 1 : 2;
  const steps = [
    { title: '사용정보 접근 허용', done: setup.usage, content: <>
      <Text style={s.body}>공부 중 어떤 앱을 사용하는지 확인하기 위한 권한이에요.</Text>
      <View style={s.guide}><Text style={s.label}>스터디앱 선택 → 사용 추적 허용 → 스터디앱으로 돌아오기</Text></View>
      <Button label={setup.usage ? '사용정보 접근 설정 보기' : '사용정보 접근 설정으로 이동'} variant="secondary" disabled={disabled} onPress={() => void run(() => guard.openUsageSettings())} />
      {!setup.usage && <>
        <Button label={restrictedHelp ? '제한된 설정 안내 접기' : '시스템에서 제한된 설정 안내가 나왔어요'} variant="ghost" onPress={() => setRestrictedHelp(value => !value)} />
        {restrictedHelp && <View style={s.help}>
          <Text style={s.label}>시스템 안내를 확인했다면 이렇게 해 주세요</Text>
          <Text style={s.body}>1. 시스템의 ‘제한된 설정’ 안내를 닫고 스터디앱으로 돌아와 주세요.</Text>
          <View style={s.guide}><Text style={s.label}>2. 아래에서 앱 정보를 열고, 오른쪽 위 ⋮ → 제한된 설정 허용을 선택해 주세요.</Text></View>
          <Button label="앱 정보로 이동" variant="secondary" disabled={disabled} onPress={() => void run(() => guard.openAppSettings())} />
          <Text style={s.caption}>메뉴가 보이지 않으면 사용정보 접근을 켜려고 할 때 시스템의 차단 안내가 나왔는지 먼저 확인해 주세요.</Text>
          <Text style={s.body}>3. 제한을 허용한 뒤 스터디앱으로 다시 돌아와 주세요. 아래 버튼으로 사용정보 접근 설정을 열고, 스터디앱의 사용 추적을 켜면 완료돼요.</Text>
          <Button label="사용정보 접근 설정 다시 열기" disabled={disabled} onPress={() => void run(() => guard.openUsageSettings())} />
        </View>}
      </>}
    </> },
    { title: '알림 허용', done: setup.notifications, content: <>
      <Text style={s.body}>허용앱 사용 중에도 공부 측정 상태를 알림으로 보여 드려요.</Text>
      {!setup.notifications && <Button label="알림 허용하기" disabled={disabled || !setup.usage} onPress={() => void run(onEnableNotifications)} />}
      <Button label="알림 설정으로 이동" variant="ghost" disabled={disabled || !setup.usage} onPress={() => void run(() => guard.openNotificationSettings())} />
    </> },
  ];
  return <Card>
    <Text accessibilityRole="header" style={s.title}>{setup.ready ? '설정이 완료됐어요' : '처음 한 번만 설정해 주세요'}</Text>
    <Text accessibilityLiveRegion="polite" style={s.body}>{!status ? '휴대폰 설정을 확인하고 있어요.' : setup.ready ? '아래에서 공부할 때 사용할 앱을 골라 주세요.' : '설정 후 스터디앱으로 돌아오면 다음 단계로 이어져요.'}</Text>
    {!setup.ready && <Text style={s.progress}>2단계 중 {Math.min(current + 1, 2)}단계</Text>}
    {(!setup.ready || expanded) && <View style={s.steps}>{steps.map((step, index) => <View key={step.title} style={s.step}>
      <View style={s.stepHeader}><Text style={[s.number, step.done && s.complete]}>{step.done ? '✓' : index + 1}</Text><Text style={s.label}>{step.title}</Text><Text style={s.caption}>{step.done ? '완료' : index === current ? '지금 설정' : '대기'}</Text></View>
      {(index === current || expanded) && <View style={s.details}>{step.content}</View>}
    </View>)}</View>}
    {setup.ready && <Button label={expanded ? '권한 설정 접기' : '권한 설정 다시 보기'} variant="ghost" onPress={() => setExpanded(value => !value)} />}
    {!setup.ready && <Text style={s.caption}>{status?.running ? '권한을 변경하려면 홈이나 집중 화면에서 공부를 일시정지해 주세요.' : '허용앱을 사용하지 않으면 이 설정 없이도 공부할 수 있어요.'}</Text>}
  </Card>;
}
const s = StyleSheet.create({
  title: { ...typography.heading, color: colors.text }, label: { ...typography.label, color: colors.text, flexShrink: 1 },
  body: { ...typography.body, color: colors.text }, caption: { ...typography.caption, color: colors.secondary },
  progress: { ...typography.label, color: colors.primary }, steps: { gap: spacing.lg },
  step: { gap: spacing.md, borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.lg },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  number: { ...typography.label, color: colors.secondary, textAlign: 'center', width: 28, lineHeight: 28, borderRadius: 14, backgroundColor: colors.background },
  complete: { color: colors.primary }, details: { gap: spacing.md },
  help: { gap: spacing.md, borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.lg },
  guide: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.background },
});
