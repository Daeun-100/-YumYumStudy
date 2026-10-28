import type { ImageSourcePropType } from 'react-native';
import { characters } from '../features/profile/CharacterPicker';
import { characterArtwork } from './character-artwork';
import type { CharacterId } from '../lib/characters';
import { supportsSkin } from '../lib/skins';
import toothacheHome from '../../assets/characters/bunny/bunny-home-toothache.png';
import toothacheFocus from '../../assets/characters/bunny/bunny-focus-toothache.png';

const source = (asset: ImageSourcePropType | string): ImageSourcePropType => typeof asset === 'string' ? { uri: asset } : asset;
export const skinArtwork: Record<string, { character: CharacterId; name: string; home: ImageSourcePropType; focus: ImageSourcePropType; homePlacement?: { scale: number; x: number; y: number }; focusBottom?: number }> = {
  // Anchors refer to the laptop base in each source canvas, not its transparent margins.
  'bunny-toothache': { character: 'bunny', name: '치통 토끼', home: source(toothacheHome), focus: source(toothacheFocus), homePlacement: { scale: .72, x: 768, y: 870 }, focusBottom: 1150 },
};
export const hasSkinArtwork = (character: CharacterId, id?: string | null) => supportsSkin(character, id, skinArtwork);
export function resolveCharacterArtwork(character: CharacterId = 'bunny', id?: string | null) {
  const skin = hasSkinArtwork(character, id) ? skinArtwork[id!] : undefined;
  return { label: skin?.name ?? characterArtwork[character].label, home: skin?.home ?? source(characters[character].image), focus: skin?.focus ?? characterArtwork[character].focus, homePlacement: skin?.homePlacement, focusBottom: skin?.focusBottom };
}
