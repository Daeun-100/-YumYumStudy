import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Text, View } from 'react-native';
import { AchievementBadge, Button, Card, SegmentedControl } from '../src/design/components';
import { colors, spacing, typography } from '../src/design/theme';
function Overview() {
  const [period, setPeriod] = useState('week');
  const [clicks, setClicks] = useState(0);
  return <View style={{ gap: spacing.xxl }}>
    <View style={{ gap: spacing.sm }}><Text style={[typography.eyebrow, { color: colors.primary }]}>YUMYUM STUDY · STORYBOOK</Text><Text style={[typography.heading, { color: colors.text }]}>우리 앱의 디자인 부품</Text><Text style={[typography.secondary, { color: colors.secondary }]}>왼쪽 메뉴에서 부품을 선택하고 Controls에서 모양과 상태를 바꿔보세요. 이곳의 데이터는 예시이며 공부 기록을 저장하지 않아요.</Text></View>
    <Card><Text style={[typography.title, { color: colors.text }]}>버튼</Text><Button label="기본 버튼 눌러보기" onPress={() => setClicks(clicks + 1)} /><Button variant="secondary" label="보조 버튼" /><Button variant="raised" label="불투명 크림 버튼" /><View style={{ flexDirection: 'row', gap: spacing.md }}><Button label="Ⅱ" size="round" accessibilityLabel="일시정지 예시" /><Button label="←" variant="ghost" size="icon" accessibilityLabel="뒤로가기 예시" /></View><Button label="로딩" loading /><Button label="비활성" disabled /><Text style={[typography.caption, { color: colors.secondary }]}>클릭 횟수: {clicks}</Text></Card>
    <Card><Text style={[typography.title, { color: colors.text }]}>흰색 선택형 전환 탭</Text><SegmentedControl accessibilityLabel="미리보기 기간" value={period} onChange={setPeriod} options={[{ value: 'week', label: '주간' }, { value: 'month', label: '월간' }]} /></Card>
    <Card variant="compact"><Text style={[typography.title, { color: colors.text }]}>목표 달성 배지</Text><View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}><AchievementBadge /><AchievementBadge compact /></View></Card>
    <Card variant="panel"><Text style={[typography.title, { color: colors.text }]}>하단 패널 카드</Text><Text style={[typography.secondary, { color: colors.secondary }]}>버튼, 카드, 글자 스타일은 실제 앱과 같은 컴포넌트를 사용합니다. theme.ts를 수정하면 이 미리보기에도 반영돼요.</Text></Card>
  </View>;
}
const meta = { title: '시작하기/전체 둘러보기', component: Overview, parameters: { controls: { disable: true } } } satisfies Meta<typeof Overview>;
export default meta;
export const Gallery: StoryObj<typeof meta> = { name: '디자인 모아보기' };
