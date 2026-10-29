import type { Preview } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../src/design/theme';

const preview: Preview = {
  tags: ['autodocs'],
  decorators: [(Story) => <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}><Story /></SafeAreaProvider>, (Story, context) => context.parameters.screenLayout ? <View style={{ padding: 16, backgroundColor: colors.canvas, minHeight: '100%', alignItems: 'center' }}><Story /></View> : <View style={{ padding: 24, backgroundColor: colors.background, width: '100%', maxWidth: 520, marginHorizontal: 'auto' }}><Story /></View>],
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    options: { storySort: { order: ['화면', '공통 컴포넌트', '기본 스타일'] } },
    backgrounds: { options: { cream: { name: '크림', value: colors.background }, white: { name: '흰색', value: '#FFFFFF' } } },
  },
};
export default preview;
