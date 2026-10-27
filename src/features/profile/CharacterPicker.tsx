import { Image, Pressable, Text, View } from 'react-native';
import { colors, typography } from '../../design/theme';
import { characterIds, type CharacterId } from '../../lib/characters';

export const characters = {
  bunny: { label: '토끼', image: require('../../../assets/characters/bunny/bunny-home.png') },
  bear: { label: '곰', image: require('../../../assets/characters/bear/bear-home.png') },
  cat: { label: '고양이', image: require('../../../assets/characters/cat/cat-home.png') },
  puppy: { label: '강아지', image: require('../../../assets/characters/puppy/puppy-home.png') },
  maltese: { label: '말티즈', image: require('../../../assets/characters/maltese/maltese-home.png') },
  pomeranian: { label: '포메라니안', image: require('../../../assets/characters/pomeranian/pomeranian-home.png') },
  blackcat: { label: '검은 고양이', image: require('../../../assets/characters/black-cat/black-cat-home.png') },
};
export function CharacterPicker({ value, onChange, disabled = false }: { value: CharacterId; onChange(value: CharacterId): void; disabled?: boolean }) {
  return <View style={{ gap: 12 }}><Text style={{ ...typography.label, color: colors.text }}>나의 캐릭터</Text><View accessibilityRole="radiogroup" accessibilityLabel="캐릭터 선택" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {characterIds.map(id => <Pressable key={id} accessibilityRole="radio" accessibilityLabel={characters[id].label} accessibilityState={{ checked: id === value, disabled }} disabled={disabled} onPress={() => onChange(id)} style={({ pressed }) => ({ width: '30%', minHeight: 104, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 2, borderColor: id === value ? colors.primary : colors.border, backgroundColor: pressed || id === value ? colors.soft : colors.surface, opacity: disabled ? .6 : 1 })}>
      <Image source={characters[id].image} resizeMode="contain" style={{ width: 92, height: 65 }} /><Text style={{ ...typography.caption, color: id === value ? colors.primary : colors.secondary }}>{characters[id].label}{id === value ? ' ✓' : ''}</Text>
    </Pressable>)}
  </View></View>;
}
