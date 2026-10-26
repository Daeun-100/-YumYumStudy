import type { ImageSourcePropType } from 'react-native';
import type { CharacterId } from '../lib/characters';
import bunnyFocus from '../../assets/characters/bunny/bunny-focus.png';
import bunnyLeave from '../../assets/characters/bunny/bunny-leave.png';
import bearFocus from '../../assets/characters/bear/bear-focus.png';
import bearLeave from '../../assets/characters/bear/bear-leave.png';
import catFocus from '../../assets/characters/cat/cat-focus.png';
import catLeave from '../../assets/characters/cat/cat-leave.png';
import puppyFocus from '../../assets/characters/puppy/puppy-focus.png';
import puppyLeave from '../../assets/characters/puppy/puppy-leave.png';
import malteseFocus from '../../assets/characters/maltese/maltese-focus.png';
import malteseLeave from '../../assets/characters/maltese/maltese-leave.png';
import pomeranianFocus from '../../assets/characters/pomeranian/pomeranian-focus.png';
import pomeranianLeave from '../../assets/characters/pomeranian/pomeranian-leave.png';

const source = (asset: ImageSourcePropType | string): ImageSourcePropType => typeof asset === 'string' ? { uri: asset } : asset;

export const characterArtwork = {
  bunny: { label: '토끼', focus: source(bunnyFocus), leave: source(bunnyLeave) },
  bear: { label: '곰', focus: source(bearFocus), leave: source(bearLeave) },
  cat: { label: '고양이', focus: source(catFocus), leave: source(catLeave) },
  puppy: { label: '강아지', focus: source(puppyFocus), leave: source(puppyLeave) },
  maltese: { label: '말티즈', focus: source(malteseFocus), leave: source(malteseLeave) },
  pomeranian: { label: '포메라니안', focus: source(pomeranianFocus), leave: source(pomeranianLeave) },
} satisfies Record<CharacterId, { label: string; focus: ImageSourcePropType; leave: ImageSourcePropType }>;
