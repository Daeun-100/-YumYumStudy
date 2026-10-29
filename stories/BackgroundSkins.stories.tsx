import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import homeOriginal from '../assets/backgrounds/home-background.png';
import homeHalloween from '../assets/backgrounds/home-background-halloween.png';
import focusOriginal from '../assets/backgrounds/focus-background.png';
import focusHalloween from '../assets/backgrounds/focus-background-halloween.png';
import blackcatHome from '../assets/characters/black-cat/black-cat-home-halloween.png';
import blackcatFocus from '../assets/characters/black-cat/black-cat-focus-halloween.png';
import malteseHome from '../assets/characters/maltese/maltese-home-halloween.png';
import malteseFocus from '../assets/characters/maltese/maltese-focus-halloween.png';
import bunnyHome from '../assets/characters/bunny/bunny-home-halloween.png';
import bunnyFocus from '../assets/characters/bunny/bunny-focus-halloween.png';
import pomeranianHome from '../assets/characters/pomeranian/pomeranian-home-halloween-pumpkin.png';
import pomeranianFocus from '../assets/characters/pomeranian/pomeranian-focus-halloween-pumpkin-v2.png';
import { Button } from '../src/design/components';
import { colors, typography } from '../src/design/theme';
import type { CharacterId } from '../src/lib/characters';
import { StudyLayout } from './screens/StudyLayouts';
import type { FocusMember } from '../src/features/study/FocusView';

const source = (asset: number | string): ImageSourcePropType => typeof asset === 'string' ? { uri: asset } : asset;
const halloweenCharacters = [
  { id: 'blackcat', label: '검은고양이', costume: '꼬마 마법사' },
  { id: 'maltese', label: '말티즈', costume: '꼬마 유령' },
  { id: 'bunny', label: '토끼', costume: '견습 뱀파이어' },
  { id: 'pomeranian', label: '포메', costume: '호박 요정' },
] as const;
const homeSources: Partial<Record<CharacterId, ImageSourcePropType>> = { blackcat: source(blackcatHome), maltese: source(malteseHome), bunny: source(bunnyHome), pomeranian: source(pomeranianHome) };
const focusSources = { blackcat: source(blackcatFocus), maltese: source(malteseFocus), bunny: source(bunnyFocus), pomeranian: source(pomeranianFocus) };
const halloweenMembers: FocusMember[] = halloweenCharacters.map(({ id, label }, index) => ({ id, character: id, name: label, time: '공부 중', active: true, self: index === 0 }));
const backgrounds = {
  home: { original: homeOriginal, halloween: homeHalloween, width: 1536, height: 1024 },
  focus: { original: focusOriginal, halloween: focusHalloween, width: 1024, height: 1536 },
};
type Props = {
  screen: 'home' | 'focus';
  theme: 'original' | 'halloween';
  character: CharacterId;
  width: number;
  height: number;
  overlay: boolean;
  guides: boolean;
};

function BackgroundPreview({ screen, theme, character, width, height, overlay, guides }: Props) {
  const [activeScreen, setScreen] = useState(screen);
  const [activeTheme, setTheme] = useState(theme);
  const [showOverlay, setOverlay] = useState(overlay);
  const [showGuides, setGuides] = useState(guides);
  const [activeCharacter, setCharacter] = useState(character);
  const scene = backgrounds[activeScreen];
  const imageWidth = Math.min(width, 480);
  const imageHeight = imageWidth * scene.height / scene.width;
  // Guides use the original canvas coordinates, independently of either generated image.
  const points = activeScreen === 'home'
    ? [{ x: 0, y: 756 }, { x: 1510, y: 793 }, { x: 1184, y: 998 }, { x: 800, y: 785 }]
    : [{ x: 512, y: 913 }, { x: 512, y: 1071 }, { x: 512, y: 1122 }];
  return <View style={s.root}>
    <Text accessibilityRole="header" style={s.title}>할로윈 배경 테스트</Text>
    <Text style={s.description}>홈은 캐릭터를 골라 보고, 집중은 네 캐릭터를 네 자리에 한 명씩 배치한 장면으로 확인하세요.</Text>
    <View style={s.controls}>
      {(['home', 'focus'] as const).map(value => <Button key={value} label={value === 'home' ? '홈' : '집중'} variant={activeScreen === value ? 'primary' : 'secondary'} onPress={() => setScreen(value)} />)}
      {(['original', 'halloween'] as const).map(value => <Button key={value} label={value === 'original' ? '기본 배경' : '할로윈 배경'} variant={activeTheme === value ? 'primary' : 'secondary'} onPress={() => setTheme(value)} />)}
    </View>
    {activeScreen === 'home' ? <View style={s.controls}>
      {halloweenCharacters.map(item => <Button key={item.id} label={item.label} accessibilityLabel={`${item.label} 홈 보기`} variant={activeCharacter === item.id ? 'primary' : 'secondary'} onPress={() => setCharacter(item.id)} />)}
    </View> : <Text style={s.description}>왼쪽부터 검은고양이 · 말티즈 · 토끼 · 포메, 각 한 자리씩이에요.</Text>}
    <View style={s.columns}>
      <View style={[s.section, { width, maxWidth: '100%' }]}>
        <Text style={s.heading}>앱 화면 미리보기</Text>
        <StudyLayout key={`${activeScreen}-${width}-${height}-${activeCharacter}`} screen={activeScreen} onScreenChange={setScreen} homeEntryPreview character={activeCharacter} running={false} width={width} height={height}
          homeArtworkSource={homeSources[activeCharacter]} focusArtworkSources={focusSources} focusMembers={halloweenMembers}
          homeBackgroundSource={source(backgrounds.home[activeTheme])} focusBackgroundSource={source(backgrounds.focus[activeTheme])} />
      </View>
      <View style={[s.section, { width: imageWidth, maxWidth: '100%' }]}>
        <Text style={s.heading}>책상 위치 비교 · {scene.width} × {scene.height}</Text>
        <View style={s.controls}>
          <Button label={showOverlay ? '50% 겹쳐보기 켜짐' : '50% 겹쳐보기 꺼짐'} variant={showOverlay ? 'primary' : 'secondary'} onPress={() => setOverlay(value => !value)} />
          <Button label={showGuides ? '기준점 켜짐' : '기준점 꺼짐'} variant={showGuides ? 'primary' : 'secondary'} onPress={() => setGuides(value => !value)} />
        </View>
        <Text style={s.description}>{showOverlay ? '기본 배경 위에 할로윈 배경을 50%로 겹쳤어요. 경계가 어긋나면 이중으로 보여요.' : '선택한 배경을 전체 캔버스 비율로 표시해요.'}</Text>
        <View style={{ width: '100%', aspectRatio: scene.width / scene.height, overflow: 'hidden' }}>
          <Image fadeDuration={0} source={source(scene[showOverlay ? 'original' : activeTheme])} resizeMode="contain" style={StyleSheet.absoluteFill} accessibilityLabel={`${activeScreen} ${showOverlay ? '기본' : activeTheme} 전체 배경`} />
          {showOverlay && <Image fadeDuration={0} source={source(scene.halloween)} resizeMode="contain" style={[StyleSheet.absoluteFill, { opacity: .5 }]} accessibilityLabel="할로윈 배경 50% 비교 레이어" />}
          {showGuides && <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {activeScreen === 'focus' && points.map(point => <View key={`line-${point.y}`} style={{ position: 'absolute', top: `${point.y / scene.height * 100}%`, left: 0, right: 0, borderTopWidth: 1, borderColor: '#00E5FF' }} />)}
            {points.map(point => <View key={`${point.x}-${point.y}`} style={{ position: 'absolute', left: `${point.x / scene.width * 100}%`, top: `${point.y / scene.height * 100}%` }}>
              <View style={s.marker} /><Text style={s.coordinate}>{point.x}, {point.y}</Text>
            </View>)}
          </View>}
        </View>
        <Text style={s.description}>청록색은 원본 책상 기준점입니다. 홈 모서리는 육안 기준이며, 집중은 중앙 경계 실측 기준입니다. 집중 배경의 상판 앞 경계에는 원본 대비 1px 차이가 남아 있어요.</Text>
        <Text style={s.description}>비교 표시 크기: {imageWidth} × {Math.round(imageHeight)}px. 배경 전환은 스토리북에만 적용됩니다.</Text>
      </View>
    </View>
  </View>;
}

const s = StyleSheet.create({
  root: { width: '100%', maxWidth: 1100, gap: 16 },
  title: { ...typography.title, color: colors.text },
  heading: { ...typography.label, color: colors.text },
  description: { ...typography.caption, color: colors.secondary },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  columns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 24 },
  section: { gap: 12 },
  marker: { position: 'absolute', left: -4, top: -4, width: 8, height: 8, borderWidth: 2, borderColor: '#00E5FF', backgroundColor: '#16343D' },
  coordinate: { marginTop: 5, marginLeft: 5, padding: 2, fontSize: 10, color: '#FFFFFF', backgroundColor: '#16343D' },
});

const meta = {
  title: '화면/배경 스킨 테스트',
  component: BackgroundPreview,
  parameters: { screenLayout: true, layout: 'fullscreen' },
  args: { screen: 'home', theme: 'halloween', character: 'blackcat', width: 390, height: 844, overlay: false, guides: true },
  argTypes: {
    screen: { control: 'inline-radio', options: ['home', 'focus'] },
    theme: { control: 'inline-radio', options: ['original', 'halloween'] },
    character: { control: 'select', options: ['blackcat', 'pomeranian', 'maltese', 'bunny', 'bear', 'cat', 'puppy'] },
    width: { control: { type: 'range', min: 320, max: 480, step: 1 } },
    height: { control: { type: 'range', min: 640, max: 960, step: 1 } },
  },
  render: args => <BackgroundPreview key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof BackgroundPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Home: Story = { name: '할로윈 · 홈' };
export const Focus: Story = { name: '할로윈 · 집중 네 캐릭터', args: { screen: 'focus' } };
export const SmallPhone: Story = { name: '작은 화면 · 320px', args: { width: 320, height: 640 } };
