import { Plane } from 'lucide-react-native';
import { View } from 'react-native';
import { colors } from './theme';

/** Rotate the wrapper so native and Storybook share the same horizontal plane. */
export function LeavePlaneIcon({ size = 19 }: { size?: number }) {
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }] }}>
    <Plane size={size} color={colors.leave} strokeWidth={1.7} />
  </View>;
}
