import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../src/design/components';
import { HomeArtwork } from '../../src/features/study/HomeArtwork';
import { FocusView } from '../../src/features/study/FocusView';
import { CharacterPicker, characters } from '../../src/features/profile/CharacterPicker';
import { characterIds, type CharacterId } from '../../src/lib/characters';
import { colors, typography } from '../../src/design/theme';
import { LeaveLayout } from '../screens/LeaveLayout';

type Props = { character: CharacterId; width: number; height: number; screen: 'home' | 'focus' | 'leave' | 'comparison'; guides: boolean };
function Preview({ character, width, height, screen, guides }: Props) {
  const [selected, setSelected] = useState(character);
  const [showAchievement, setShowAchievement] = useState(false);
  const [seats, setSeats] = useState<CharacterId[]>(['bunny', 'maltese', 'pomeranian', 'blackcat']);
  const [scene, setScene] = useState({ width, height: 360 });
  const phone = { width, height, borderWidth: 1, borderColor: colors.border, borderRadius: 24, overflow: 'hidden' as const, backgroundColor: colors.background };
  const screens = screen === 'comparison' ? ['home', 'focus', 'leave'] as const : [screen];
  return <View style={{ gap: 24, width: '100%', alignItems: 'center' }}>
    <View style={{ maxWidth: 600, width: '100%', gap: 8 }}>{screen === 'focus' ? <View style={{ gap: 16 }}>{seats.map((seat, index) => <View key={index} style={{ gap: 4 }}><Text style={{ ...typography.label, color: colors.text }}>{index + 1}번 자리{index === 0 ? ' · 나' : ''}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{characterIds.map(value => <Button key={value} size="compact" variant={seat === value ? 'raised' : 'ghost'} label={`${characters[value].label}${seat === value ? ' ✓' : ''}`} onPress={() => setSeats(previous => previous.map((entry, i) => i === index ? value : entry))} />)}</View></View>)}<Button label={showAchievement ? '달성 효과 켜짐' : '달성 효과 꺼짐'} onPress={() => setShowAchievement(value => !value)} /></View> : <CharacterPicker value={selected} onChange={setSelected} />}<Text style={{ ...typography.caption, color: colors.secondary }}>서버 연결 없음 · 선택은 이 미리보기에만 적용돼요. Controls에서 화면 크기와 정렬선을 바꿀 수 있어요.</Text></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 24 }}>
      {screens.map(current => <View key={current} style={{ gap: 8 }}>
        <Text style={{ ...typography.title, color: colors.text }}>{screen === 'focus' ? '선택한 캐릭터' : characters[selected].label} · {{ home: '홈', focus: '집중', leave: '연차' }[current]}</Text>
        {current === 'leave' ? <LeaveLayout key={`${selected}-${width}-${height}`} character={selected} width={width} height={height} /> : <View style={phone}>
          <View style={{ height: 44, justifyContent: 'center', paddingHorizontal: 24 }}><Text style={{ color: colors.text }}>9:41</Text></View>
          {current === 'home' ? <>
            <View style={{ marginHorizontal: 24, minHeight: 268, paddingTop: 32, gap: 20 }}><Text style={{ ...typography.body, color: colors.text }}>오늘 공부한 시간</Text><Text style={{ ...typography.metric, fontSize: 54, color: colors.text }}>01:20:15</Text><Text style={{ color: colors.secondary }}>오늘 목표 3시간</Text></View>
            <View onLayout={({ nativeEvent }) => setScene(nativeEvent.layout)} style={{ flex: 1, minHeight: 360, overflow: 'hidden', paddingBottom: 16 }}>
              <HomeArtwork character={selected} width={scene.width} height={scene.height} />
              {guides && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: (scene.height - 1024 * Math.max(scene.width / 1536, scene.height / 1024)) / 2 + 785 * Math.max(scene.width / 1536, scene.height / 1024), borderTopWidth: 1, borderColor: '#E15353', borderStyle: 'dashed' }} />}
              <View style={{ flex: 1, minHeight: 284 }} /><View style={{ marginHorizontal: 16, minHeight: 52, backgroundColor: colors.surface, borderRadius: 16, padding: 16 }}><Text style={{ color: colors.secondary }}>지금 3명이 공부 중이에요</Text></View>
            </View><View style={{ height: 104 }} />
          </> : <FocusView members={Array.from({ length: 4 }, (_, i) => ({ id: String(i), name: i === 0 ? '나' : `친구 ${i}`, time: '1시간 20분', active: true, character: screen === 'focus' ? seats[i] : selected, self: i === 0, achieved: screen === 'focus' && showAchievement }))} memberCount={4} seconds={screen === 'focus' && showAchievement ? 10800 : 4815} goalMinutes={180} running={false} onBack={() => {}} onFriends={() => {}} onToggle={() => {}} />}
        </View>}
      </View>)}
    </View>
  </View>;
}
const meta = {
  title: '에셋 확인/캐릭터 화면 배치', component: Preview,
  parameters: { screenLayout: true, layout: 'fullscreen', docs: { description: { component: '홈은 실제 앱의 HomeArtwork, 집중은 FocusView, 연차는 LeaveView를 공유합니다. 서버에 연결하거나 프로필을 저장하지 않습니다. 홈의 주변 UI는 배치 확인용 샘플입니다. 정렬선은 홈 배경의 책상 기준선입니다.' } } },
  args: { character: 'blackcat', width: 390, height: 844, screen: 'comparison', guides: false },
  argTypes: { character: { control: 'select', options: characterIds }, screen: { control: 'select', options: ['home', 'focus', 'leave', 'comparison'] }, width: { control: { type: 'range', min: 320, max: 430, step: 1 } }, height: { control: { type: 'range', min: 640, max: 932, step: 1 } }, guides: { control: 'boolean' } },
  render: args => <Preview key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Compare: Story = { name: '홈·집중·연차 비교' };
export const Home: Story = { name: '홈 배치', args: { screen: 'home', guides: true } };
export const Focus: Story = { name: '집중 4자리 배치', args: { screen: 'focus' } };
export const Leave: Story = { name: '연차 배치', args: { screen: 'leave' } };
export const Small: Story = { name: '작은 휴대폰', args: { width: 320, height: 740 } };
export const Tall: Story = { name: '긴 휴대폰', args: { width: 430, height: 932 } };

export const HomeAllCharacters: Story = {
  name: '홈 · 전체 캐릭터 크기 비교',
  parameters: { controls: { disable: true } },
  render: () => <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 }}>{characterIds.map(character => <View key={character} style={{ gap: 8 }}><Text style={{ ...typography.label, color: colors.text }}>{characters[character].label}</Text><View style={{ width: 320, height: 360, overflow: 'hidden', borderRadius: 16 }}><HomeArtwork character={character} width={320} height={360} /><View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: (360 - 1024 * (360 / 1024)) / 2 + 785 * (360 / 1024), borderTopWidth: 1, borderColor: '#E15353', borderStyle: 'dashed' }} /></View></View>)}</View>,
};

export const LeaveAllCharacters: Story = {
  name: '연차 · 전체 캐릭터 잘림 확인',
  parameters: { controls: { disable: true } },
  render: () => <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 }}>{characterIds.map(character => <View key={character} style={{ gap: 8 }}><Text style={{ ...typography.label, color: colors.text }}>{characters[character].label} · 320px</Text><LeaveLayout character={character} width={320} height={740} /></View>)}</View>,
};
