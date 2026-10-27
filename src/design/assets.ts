import watermelon from '../../assets/icons/watermelon-icon.png';
import type { ImageSourcePropType } from 'react-native';

export const designAssets = {
  watermelon: (typeof watermelon === 'string' ? { uri: watermelon } : watermelon) as ImageSourcePropType,
};
