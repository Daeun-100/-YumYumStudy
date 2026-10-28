import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../src/design/components';
import { skinArtwork } from '../../src/design/skin-artwork';
import { colors, typography } from '../../src/design/theme';
import { StudyLayout } from '../screens/StudyLayouts';
import { FocusView } from '../../src/features/study/FocusView';

type Props = { skinId: string; screen: 'home' | 'focus' | 'comparison'; width: number; height: number; compareOriginal: boolean };

function SkinPlacement({ skinId, screen, width, height, compareOriginal }: Props) {
  const [selected, setSelected] = useState(skinId);
  const screens = screen === 'comparison' ? ['home', 'focus'] as const : [screen];
  const variants = compareOriginal ? [undefined, selected] : [selected];
  return <View style={{ width: '100%', gap: 24, alignItems: 'center' }}>
    <View style={{ gap: 10, maxWidth: 800, width: '100%' }}>
      <Text style={{ ...typography.title, color: colors.text }}>스킨 배치 테스트</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {Object.entries(skinArtwork).map(([id, skin]) => <Button key={id} label={`${skin.name}${selected === id ? ' ✓' : ''}`} variant={selected === id ? 'raised' : 'ghost'} size="compact" onPress={() => setSelected(id)} />)}
      </View>
      <Text style={{ ...typography.caption, color: colors.secondary }}>원본과 같은 화면 크기에서 노트북 바닥·테이블 접점·귀 잘림을 비교해요. 선택은 이 미리보기에만 적용돼요.</Text>
    </View>
    {screens.map(current => <View key={current} style={{ width: '100%', gap: 12 }}>
      <Text style={{ ...typography.title, color: colors.text, textAlign: 'center' }}>{current === 'home' ? '홈 화면' : '집중 화면'}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 24 }}>
        {variants.map(id => <View key={id ?? 'original'} style={{ gap: 8, maxWidth: '100%' }}>
          <Text style={{ ...typography.label, color: colors.text, textAlign: 'center' }}>{id ? skinArtwork[id]?.name : '기본 토끼'} · {width}px</Text>
          {current === 'home' ? <StudyLayout key={`${current}-${id}-${width}-${height}`} screen="home" activeSkinId={id} width={width} height={height} running={false} homeEntryPreview /> : <View style={{ width, height, maxWidth: '100%', borderRadius: 32, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.background }}>
            <View style={{ height: 44, paddingHorizontal: 24, justifyContent: 'center' }}><Text style={{ color: colors.text }}>9:41</Text></View>
            <FocusView initialSceneSize={{ width, height: Math.max(240, height - 394) }} members={[
              { id: 'self', name: '나', time: '1시간 20분', character: 'bunny', activeSkinId: id, self: true, active: true },
              { id: 'baseline', name: '기본 토끼', time: '53분', character: 'bunny', active: true },
              { id: 'bear', name: '곰', time: '2시간', character: 'bear', active: true },
              { id: 'cat', name: '고양이', time: '32분', character: 'cat', active: true },
            ]} memberCount={4} seconds={4815} sessionSeconds={1680} goalMinutes={180} running={false} onBack={() => {}} onFriends={() => {}} onToggle={() => {}} />
          </View>}
        </View>)}
      </View>
    </View>)}
  </View>;
}

const meta = {
  title: '에셋 확인/스킨 배치 테스트', component: SkinPlacement,
  parameters: { screenLayout: true, layout: 'fullscreen' },
  args: { skinId: 'bunny-toothache', screen: 'comparison', width: 390, height: 844, compareOriginal: true },
  argTypes: {
    skinId: { control: 'select', options: Object.keys(skinArtwork) },
    screen: { control: 'select', options: ['home', 'focus', 'comparison'] },
    width: { control: { type: 'range', min: 320, max: 430, step: 1 } },
    height: { control: { type: 'range', min: 640, max: 932, step: 1 } },
    compareOriginal: { control: 'boolean' },
  },
  render: args => <SkinPlacement key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof SkinPlacement>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Compare: Story = { name: '홈·집중 · 원본과 비교' };
export const Toothache: Story = { name: '치통 토끼 · 전달 이미지 적용', args: { screen: 'comparison', compareOriginal: false } };
export const Home: Story = { name: '홈 배치', args: { screen: 'home' } };
export const Focus: Story = { name: '집중 배치', args: { screen: 'focus' } };
export const Small: Story = { name: '작은 화면 · 320px', args: { width: 320, height: 740 } };
export const Tall: Story = { name: '긴 화면 · 430px', args: { width: 430, height: 932 } };
