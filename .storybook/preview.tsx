import type { Preview } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { colors } from '../src/design/theme';

const preview: Preview = {
  tags: ['autodocs'],
  decorators: [(Story, context) => context.parameters.screenLayout ? <View style={{ padding: 16, backgroundColor: colors.canvas, minHeight: '100%', alignItems: 'center' }}><Story /></View> : <View style={{ padding: 24, backgroundColor: colors.background, width: '100%', maxWidth: 520, marginHorizontal: 'auto' }}><Story /></View>],
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    options: { storySort: { order: ['화면 시안', '시작하기', '기본 스타일', '공통 컴포넌트'] } },
    backgrounds: { options: { cream: { name: '크림', value: colors.background }, white: { name: '흰색', value: '#FFFFFF' } } },
  },
};
export default preview;
