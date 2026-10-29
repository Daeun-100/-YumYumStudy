import watermelon from '../../assets/icons/watermelon-icon.png';
import goldWatermelon from '../../assets/icons/watermelon-icon-gold.png';
import type { ImageSourcePropType } from 'react-native';

export const designAssets = {
  goldWatermelon: (typeof goldWatermelon === 'string' ? { uri: goldWatermelon } : goldWatermelon) as ImageSourcePropType,
  watermelon: (typeof watermelon === 'string' ? { uri: watermelon } : watermelon) as ImageSourcePropType,
};
