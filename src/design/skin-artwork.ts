import type { SkinEffect } from './skin-effects';
import type { ImageSourcePropType } from 'react-native';
import { characters } from '../features/profile/CharacterPicker';
import { characterArtwork } from './character-artwork';
import type { CharacterId } from '../lib/characters';
import { supportsSkin } from '../lib/skins';
import toothacheHome from '../../assets/characters/bunny/bunny-home-toothache.png';
import toothacheFocus from '../../assets/characters/bunny/bunny-focus-toothache.png';
import blackcatBungeoppangHome from '../../assets/characters/black-cat/black-cat-home-bungeoppang.png';
import blackcatBungeoppangFocus from '../../assets/characters/black-cat/black-cat-focus-bungeoppang.png';
import malteseBungeoppangHome from '../../assets/characters/maltese/maltese-home-bungeoppang.png';
import malteseBungeoppangFocus from '../../assets/characters/maltese/maltese-focus-bungeoppang.png';

import pomeranianBungeoppangHome from '../../assets/characters/pomeranian/pomeranian-home-bungeoppang.png';
import pomeranianBungeoppangFocus from '../../assets/characters/pomeranian/pomeranian-focus-bungeoppang.png';
import bunnyBungeoppangHome from '../../assets/characters/bunny/bunny-home-bungeoppang.png';
import bunnyBungeoppangFocus from '../../assets/characters/bunny/bunny-focus-bungeoppang.png';

const source = (asset: ImageSourcePropType | string): ImageSourcePropType => typeof asset === 'string' ? { uri: asset } : asset;
export const skinArtwork: Record<string, { character: CharacterId; name: string; home: ImageSourcePropType; focus: ImageSourcePropType; homePlacement?: { scale: number; x: number; y: number }; focusBottom?: number; effects?: readonly SkinEffect[] }> = {
  // Anchors refer to the laptop base in each source canvas, not its transparent margins.
  'bunny-toothache': { character: 'bunny', name: '치통 토끼', home: source(toothacheHome), focus: source(toothacheFocus), homePlacement: { scale: .72, x: 768, y: 870 }, focusBottom: 1150 },
  'bunny-bungeoppang': { character: 'bunny', name: '붕어빵 토끼', home: source(bunnyBungeoppangHome), focus: source(bunnyBungeoppangFocus), effects: [{ kind: 'warmSteam', home: { x: 0.55, y: 0.23, width: .10, opacity: .6 }, focus: { x: 0.48, y: 0.19, width: .12, opacity: .4 } }] },
  'pomeranian-bungeoppang': { character: 'pomeranian', name: '붕어빵 포메라니안', home: source(pomeranianBungeoppangHome), focus: source(pomeranianBungeoppangFocus), effects: [{ kind: 'warmSteam', home: { x: 0.57, y: 0.08, width: .10, opacity: .6 }, focus: { x: 0.55, y: 0.09, width: .12, opacity: .4 } }] },
  'blackcat-bungeoppang': { character: 'blackcat', name: '붕어빵 검은고양이', home: source(blackcatBungeoppangHome), focus: source(blackcatBungeoppangFocus), effects: [{ kind: 'warmSteam', home: { x: 0.59, y: 0.07, width: .10, opacity: .6 }, focus: { x: 0.54, y: 0.08, width: .12, opacity: .4 } }] },
  'maltese-bungeoppang': { character: 'maltese', name: '붕어빵 말티즈', home: source(malteseBungeoppangHome), focus: source(malteseBungeoppangFocus), effects: [{ kind: 'warmSteam', home: { x: 0.57, y: 0.12, width: .10, opacity: .6 }, focus: { x: 0.53, y: 0.1, width: .12, opacity: .4 } }] },
};
export const hasSkinArtwork = (character: CharacterId, id?: string | null) => supportsSkin(character, id, skinArtwork);
export function resolveCharacterArtwork(character: CharacterId = 'bunny', id?: string | null) {
  const skin = hasSkinArtwork(character, id) ? skinArtwork[id!] : undefined;
  return { label: skin?.name ?? characterArtwork[character].label, home: skin?.home ?? source(characters[character].image), focus: skin?.focus ?? characterArtwork[character].focus, homePlacement: skin?.homePlacement, focusBottom: skin?.focusBottom, effects: skin?.effects };
}
