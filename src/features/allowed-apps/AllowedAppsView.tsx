import type { ReactNode } from 'react';
import { SectionList, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button, Card } from '../../design/components';
import { colors, spacing, typography } from '../../design/theme';
import { allowedAppsSetup } from './setup';
import { allowedAppSections } from './app-list';
import { AllowedAppIcon } from './AllowedAppIcon';
import type { GuardApp, GuardStatus } from './native';

type Props = {
  nativeAvailable: boolean; status: GuardStatus | null; apps: GuardApp[]; setupContent: ReactNode;
  error: string; busy: boolean; search: string; onSearch(value: string): void; onBack(): void;
  pendingPackages?: string[];
  onSelect(packageName: string, selected: boolean): void;
};
export function AllowedAppsView({ nativeAvailable, status, apps, setupContent, error, busy, pendingPackages = [], search, onSearch, onBack, onSelect }: Props) {
  const setup = allowedAppsSetup(status);
  const sections = allowedAppSections(apps, status?.allowed ?? [], search);
  const header = <View style={s.content}>
    <Text style={s.body}>공부할 때 필요한 앱을 골라 주세요. 허용앱을 사용하는 동안에도 공부 시간이 쌓여요.</Text>
    {!nativeAvailable ? <Card><Text style={s.heading}>안드로이드 앱에서 설정해 주세요</Text><Text style={s.body}>웹에서는 허용앱을 설정할 수 없어요. 다른 앱으로 이동해도 공부 시간은 계속 쌓여요.</Text></Card> : <>
      {setupContent}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {setup.ready && <>
        <View style={s.section}><Text accessibilityRole="header" style={s.heading}>내 허용앱</Text><Text style={s.caption}>{status?.allowed.length ?? 0}개 선택</Text></View>
        <Text style={s.caption}>{status?.running ? '공부 중에는 목록을 바꿀 수 없어요. 홈이나 집중 화면에서 일시정지한 뒤 변경해 주세요.' : '앱 옆의 스위치를 켜면 바로 저장돼요.'}</Text>
        <TextInput accessibilityLabel="설치된 앱 검색" value={search} onChangeText={onSearch} placeholder="앱 이름으로 검색" style={s.search} />
        <Text style={s.caption}>허용한 앱을 먼저 보여 드려요. 각 목록은 이름순이에요.</Text>
      </>}
    </>}
  </View>;
  return <View style={s.page}>
    <View style={s.header}><Button label="←" accessibilityLabel="이전 화면으로 돌아가기" size="icon" variant="ghost" onPress={onBack} /><Text style={s.heading}>허용앱 설정</Text></View>
    <SectionList sections={nativeAvailable && setup.ready ? sections : []} stickySectionHeadersEnabled={false} keyExtractor={item => item.packageName}
      ListHeaderComponent={header} keyboardShouldPersistTaps="handled"
      renderSectionHeader={({ section }) => <View style={s.sectionHeader}>
        <View style={s.section}><Text accessibilityRole="header" style={s.title}>{section.title}</Text><Text style={s.caption}>{section.data.length}개</Text></View>
        {!section.data.length && <Text style={s.caption}>{search.trim() ? '검색 결과가 없어요.' : section.key === 'allowed' ? '아직 허용한 앱이 없어요.' : '선택할 수 있는 다른 앱이 없어요.'}</Text>}
      </View>}
      renderItem={({ item }) => <View style={s.app}>
        <AllowedAppIcon app={item} size={36} />
        <View style={{ flex: 1 }}><Text style={s.body}>{item.label}</Text>{pendingPackages.includes(item.packageName) && <Text accessibilityLiveRegion="polite" style={s.caption}>저장 중…</Text>}</View>
        <Switch accessibilityLabel={`${item.label} 허용`} value={status?.allowed.includes(item.packageName) ?? false} disabled={busy || pendingPackages.includes(item.packageName) || !status || status.running} onValueChange={value => onSelect(item.packageName, value)} />
      </View>}
      ListFooterComponent={nativeAvailable ? <View style={s.content}><Card>
        <Text style={s.label}>허용앱은 이렇게 사용해요</Text>
        <Text style={s.body}>홈이나 집중 화면에서 공부를 시작한 뒤, ‘허용앱’ 버튼으로 앱을 열어 주세요.</Text>
        <Text style={s.caption}>다른 허용앱으로 옮길 때도 스터디앱으로 돌아와 열어 주세요. 홈 화면이나 다른 앱으로 나가면 공부가 일시정지돼요. 돌아온 뒤 직접 재개해 주세요.</Text>
      </Card><Text style={s.caption}>선택한 앱 목록은 이 기기에만 저장돼요.</Text></View> : undefined} />
  </View>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  content: { padding: spacing.xl, gap: spacing.lg }, heading: { ...typography.heading, color: colors.text }, label: { ...typography.label, color: colors.text },
  body: { ...typography.body, color: colors.text }, caption: { ...typography.caption, color: colors.secondary }, error: { ...typography.secondary, color: colors.error },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  title: { ...typography.title, color: colors.text },
  sectionHeader: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md, gap: spacing.sm },
  app: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderBottomWidth: 1, borderColor: colors.border },
  search: { ...typography.body, borderWidth: 1, borderColor: colors.border, padding: spacing.md, borderRadius: 12, color: colors.text },
});
