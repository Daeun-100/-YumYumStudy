import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Image, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { characterArtwork } from '../../src/design/character-artwork';
import { characterIds, type CharacterId } from '../../src/lib/characters';
import { AchievementAura } from '../../src/features/study/AchievementAura';
import { FocusView } from '../../src/features/study/FocusView';
import { colors } from '../../src/design/theme';
function Effects({ opacity = 1, effectOnly = false }: { opacity?: number; effectOnly?: boolean }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20 }}>{characterIds.map((character: CharacterId) => <View key={character} style={{ gap: 8 }}><Text style={{ color: colors.text }}>{characterArtwork[character].label}</Text><View style={{ width: 280, height: 280, backgroundColor: '#D5BC91', borderRadius: 20 }}>
    <AchievementAura character={character} size={280} opacity={opacity} />
    {!effectOnly && <Image source={characterArtwork[character].focus} resizeMode="contain" style={{ position: 'absolute', width: '100%', height: '100%' }} />}
  </View></View>)}</View>;
}
const meta = { title: '에셋 확인/목표 달성 반짝임', component: Effects, parameters: { screenLayout: true }, args: { opacity: 1, effectOnly: false }, argTypes: { opacity: { control: { type: 'range', min: 0, max: 1, step: .05 } } } } satisfies Meta<typeof Effects>;
export default meta;
export const Overlay: StoryObj<typeof meta> = { name: '동물별 겹쳐 보기' };
export const EffectOnly: StoryObj<typeof meta> = { name: '투명 효과만', args: { effectOnly: true } };

export const FocusRoom: StoryObj<typeof meta> = {
  name: '집중방 · 목표 달성 효과',
  decorators: [(Story) => <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}><Story /></SafeAreaProvider>],
  parameters: { controls: { disable: true } },
  render: () => <View style={{ width: 390, height: 844, alignSelf: 'center', backgroundColor: colors.background }}><FocusView members={(['bunny', 'maltese', 'pomeranian', 'blackcat'] as const).map((character, i) => ({ id: String(i), name: ['나', '말티즈', '포메', '검은 고양이'][i], time: '목표 달성', active: true, character, self: i === 0, achieved: true }))} memberCount={4} seconds={10800} goalMinutes={180} running={false} onBack={() => {}} onFriends={() => {}} onToggle={() => {}} /></View>,
};
