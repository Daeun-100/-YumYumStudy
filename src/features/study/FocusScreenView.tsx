import type { ReactNode } from 'react';
import { View } from 'react-native';
import { FocusView, type FocusViewProps } from './FocusView';
import { ui } from './study-styles';

type Props = FocusViewProps & { timerControl: ReactNode; onAllowedApps(): void; children?: ReactNode };
/** The actual focus-screen shell. App and Storybook supply state, never separate layouts. */
export function FocusScreenView({ children, ...props }: Props) {
  return <View style={ui.outer}><View style={ui.page}>
    <FocusView {...props} />
    {children}
  </View></View>;
}
