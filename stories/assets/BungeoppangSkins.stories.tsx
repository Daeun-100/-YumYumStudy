import { SkinEffects } from '../../src/features/study/SkinEffects';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { Image, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { HomeArtwork } from '../../src/features/study/HomeArtwork';
import { FocusView } from '../../src/features/study/FocusView';
import { skinArtwork } from '../../src/design/skin-artwork';
import { colors, typography } from '../../src/design/theme';

const skins = ['bunny-bungeoppang', 'pomeranian-bungeoppang', 'blackcat-bungeoppang', 'maltese-bungeoppang'] as const;
type SkinId = typeof skins[number];
type Props = {
  skinId: SkinId;
  screen: 'home' | 'focus' | 'comparison' | 'assets';
  width: number;
  height: number;
  compareOriginal: boolean;
  mixedSeats: boolean;
  effectsEnabled: boolean;
  effectStrength: number;
};

function HomePreview({ skinId, width, height, original, effectsEnabled = true, effectStrength = 1 }: { effectsEnabled?: boolean; effectStrength?: number; skinId: SkinId; width: number; height: number; original: boolean }) {
  const [scene, setScene] = useState({ width, height: 360 });
  const skin = skinArtwork[skinId];
  return <View style={{ width, height, borderRadius: 24, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.background }}>
    <View style={{ height: 44, paddingHorizontal: 24, justifyContent: 'center' }}><Text style={{ color: colors.text }}>9:41</Text></View>
    <View style={{ minHeight: 268, paddingHorizontal: 24, paddingTop: 32, gap: 20 }}>
      <Text style={{ ...typography.body, color: colors.text }}>오늘 공부한 시간</Text>
      <Text style={{ ...typography.metric, fontSize: 54, color: colors.text }}>01:20:15</Text>
      <Text style={{ color: colors.secondary }}>오늘 목표 3시간</Text>
    </View>
    <View onLayout={({ nativeEvent }) => setScene(nativeEvent.layout)} style={{ flex: 1, minHeight: 360, overflow: 'hidden', paddingBottom: 16 }}>
      <HomeArtwork effectsEnabled={effectsEnabled} effectStrength={effectStrength} character={skin.character} activeSkinId={original ? undefined : skinId} width={scene.width} height={scene.height} />
      <View style={{ flex: 1, minHeight: 284 }} />
      <View style={{ marginHorizontal: 16, minHeight: 52, padding: 16, borderRadius: 16, backgroundColor: colors.surface }}><Text style={{ color: colors.secondary }}>지금 3명이 공부 중이에요</Text></View>
    </View>
    <View style={{ height: 104 }} />
  </View>;
}

function FocusPreview({ skinId, width, height, original, mixedSeats, effectsEnabled = true, effectStrength = 1 }: { effectsEnabled?: boolean; effectStrength?: number; skinId: SkinId; width: number; height: number; original: boolean; mixedSeats: boolean }) {
  return <View style={{ width, height, borderRadius: 24, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.background }}>
    <View style={{ height: 44, paddingHorizontal: 24, justifyContent: 'center' }}><Text style={{ color: colors.text }}>9:41</Text></View>
    <FocusView effectsEnabled={effectsEnabled} effectStrength={effectStrength} initialSceneSize={{ width, height: Math.max(240, height - 394) }} members={Array.from({ length: 4 }, (_, index) => {
      const id = mixedSeats ? skins[index % skins.length] : skinId;
      return { id: `seat-${index}`, name: index === 0 ? '나' : `친구 ${index}`, time: '1시간 20분', character: skinArtwork[id].character, activeSkinId: original ? undefined : id, self: index === 0, active: true };
    })} memberCount={4} seconds={4815} sessionSeconds={1680} goalMinutes={180} running={false} onBack={() => {}} onFriends={() => {}} onToggle={() => {}} />
  </View>;
}

function EffectAsset({ skinId, screen, width, effectsEnabled, effectStrength }: { skinId: SkinId; screen: 'home' | 'focus'; width: number; effectsEnabled: boolean; effectStrength: number }) {
  const skin = skinArtwork[skinId];
  const height = screen === 'home' ? width * 2 / 3 : width;
  return <View style={{ width, height }}><Image source={skin[screen]} resizeMode="contain" style={{ width, height }} /><SkinEffects effects={skin.effects} screen={screen} width={width} height={height} enabled={effectsEnabled} strength={effectStrength} /></View>;
}

function Preview({ skinId, screen, width, height, compareOriginal, mixedSeats, effectsEnabled, effectStrength }: Props) {
  const skin = skinArtwork[skinId];
  const screens = screen === 'comparison' ? ['home', 'focus'] as const : screen === 'assets' ? [] : [screen];
  return <View style={{ width: '100%', alignItems: 'center', gap: 16 }}>
    <Text accessibilityRole="header" style={{ ...typography.title, color: colors.text }}>{skin.name}</Text>
    <Text style={{ ...typography.caption, color: colors.secondary, textAlign: 'center' }}>홈은 실제 HomeArtwork, 집중은 FocusView의 4자리 배치를 사용해요. Controls에서 캐릭터·화면 크기·원본 비교를 바꿀 수 있어요.</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 24 }}>
      {screens.map(current => (compareOriginal ? [true, false] : [false]).map(original => <View key={`${current}-${original}`} style={{ gap: 8 }}>
        <Text style={{ ...typography.label, color: colors.text, textAlign: 'center' }}>{current === 'home' ? '홈' : '집중 · 4명'} · {original ? '기본 캐릭터' : '붕어빵 스킨'}</Text>
        {current === 'home' ? <HomePreview key={`${skinId}-${width}-${height}-${original}`} skinId={skinId} width={width} height={height} effectsEnabled={effectsEnabled} effectStrength={effectStrength} original={original} /> : <FocusPreview skinId={skinId} width={width} height={height} effectsEnabled={effectsEnabled} effectStrength={effectStrength} original={original} mixedSeats={mixedSeats} />}
      </View>))}
      {screen === 'assets' && (['home', 'focus'] as const).map(state => <View key={state} style={{ width, gap: 8 }}>
        <Text style={{ ...typography.label, color: colors.text }}>{state === 'home' ? '홈 · 1536×1024' : '집중 · 1254×1254'}</Text>
        <View style={{ width, height: state === 'home' ? width * 2 / 3 : width, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
          <EffectAsset skinId={skinId} screen={state} width={width} effectsEnabled={effectsEnabled} effectStrength={effectStrength} />
        </View>
      </View>)}
    </View>
  </View>;
}

const meta = {
  title: '에셋 확인/붕어빵 스킨', component: Preview,
  parameters: { screenLayout: true, layout: 'fullscreen' },
  args: { skinId: 'blackcat-bungeoppang', screen: 'comparison', width: 390, height: 844, compareOriginal: false, mixedSeats: false, effectsEnabled: true, effectStrength: 1 },
  argTypes: {
    skinId: { control: 'select', options: skins },
    screen: { control: 'select', options: ['home', 'focus', 'comparison', 'assets'] },
    width: { control: { type: 'range', min: 320, max: 430, step: 1 } },
    height: { control: { type: 'range', min: 640, max: 932, step: 1 } },
    compareOriginal: { control: 'boolean' }, mixedSeats: { control: 'boolean' },
    effectsEnabled: { control: 'boolean', name: '김 효과' },
    effectStrength: { control: { type: 'range', min: 0, max: 2, step: .1 }, name: '효과 강도' },
  },
  render: args => <Preview {...args} />,
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Blackcat: Story = { name: '검은고양이 · 홈 + 집중 4명' };
export const Pomeranian: Story = { name: '포메라니안 · 홈 + 집중 4명', args: { skinId: 'pomeranian-bungeoppang' } };
export const Bunny: Story = { name: '토끼 · 홈 시안 + 집중 4명', args: { skinId: 'bunny-bungeoppang' } };
export const Maltese: Story = { name: '말티즈 · 홈 + 집중 4명', args: { skinId: 'maltese-bungeoppang' } };
export const Mixed: Story = { name: '네 스킨 · 집중 4명', args: { screen: 'focus', mixedSeats: true } };
export const Original: Story = { name: '기본 캐릭터와 비교', args: { compareOriginal: true } };
export const Assets: Story = { name: '투명 에셋 확인', args: { screen: 'assets' } };
export const Small: Story = { name: '작은 화면 · 홈 + 집중 4명', args: { width: 320, height: 740 } };


function Lineup({ screen, width, height, effectsEnabled, effectStrength }: Pick<Props, 'width' | 'height' | 'effectsEnabled' | 'effectStrength'> & { screen: 'home' | 'focus' }) {
  const viewport = useWindowDimensions();
  return <View style={{ width: Math.max(0, viewport.width - 32), gap: 16 }}>
    <Text accessibilityRole="header" style={{ ...typography.title, color: colors.text }}>붕어빵 스킨 · {screen === 'home' ? '홈' : '집중'} 나란히 보기</Text>
    <Text style={{ ...typography.caption, color: colors.secondary }}>토끼 · 포메라니안 · 검은고양이 · 말티즈 순서예요. 토끼 홈은 현재 시안이며, 좁은 화면에서는 가로로 스크롤할 수 있어요.</Text>
    <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
      {skins.map(skinId => <View key={skinId} style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <Text style={{ ...typography.label, color: colors.text, textAlign: 'center' }}>{skinArtwork[skinId].name.replace('붕어빵 ', '')}{skinId === 'bunny-bungeoppang' && screen === 'home' ? ' · 시안' : ''}</Text>
        <View style={{ width: '100%', aspectRatio: screen === 'home' ? 1.5 : 1, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
          <Image source={skinArtwork[skinId][screen]} resizeMode="contain" style={{ width: '100%', height: '100%' }} accessibilityLabel={`${skinArtwork[skinId].name} ${screen === 'home' ? '홈' : '집중'} 에셋`} />
        </View>
      </View>)}
    </View>
    <Text style={{ ...typography.label, color: colors.text }}>실제 화면 배치 · 가로 스크롤</Text>
    <ScrollView horizontal contentContainerStyle={{ gap: 24, paddingBottom: 16 }}>
      {skins.map(skinId => <View key={skinId} style={{ width, gap: 12 }}>
        <Text style={{ ...typography.label, color: colors.text, textAlign: 'center' }}>{skinArtwork[skinId].name}{skinId === 'bunny-bungeoppang' && screen === 'home' ? ' · 홈 시안' : ''}</Text>
        {screen === 'home' ? <HomePreview skinId={skinId} width={width} height={height} effectsEnabled={effectsEnabled} effectStrength={effectStrength} original={false} /> : <FocusPreview skinId={skinId} width={width} height={height} effectsEnabled={effectsEnabled} effectStrength={effectStrength} original={false} mixedSeats={false} />}
      </View>)}
    </ScrollView>
  </View>;
}

export const HomeLineup: Story = { name: '네 캐릭터 나란히 · 홈', render: args => <Lineup screen="home" width={args.width} height={args.height} effectsEnabled={args.effectsEnabled} effectStrength={args.effectStrength} /> };
export const FocusLineup: Story = { name: '네 캐릭터 나란히 · 집중', render: args => <Lineup screen="focus" width={args.width} height={args.height} effectsEnabled={args.effectsEnabled} effectStrength={args.effectStrength} /> };

export const SteamEffects: Story = { name: '김 효과 · 홈 + 집중', args: { effectsEnabled: true, effectStrength: 1.5 } };
export const WithoutEffects: Story = { name: '김 효과 끄기', args: { effectsEnabled: false } };
