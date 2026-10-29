import { mergeConfig } from 'vite';
import { resolve } from 'node:path';
import type { StorybookConfig } from '@storybook/react-native-web-vite';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.tsx'],
  addons: ['@storybook/addon-docs'],
  framework: '@storybook/react-native-web-vite',
  core: { disableTelemetry: true },
  viteFinal: async config => {
    config.optimizeDeps = {
      ...config.optimizeDeps,
      include: [...(config.optimizeDeps?.include ?? []).filter(value => !value.includes('react-native-svg') && !value.includes('lucide'))],
      exclude: [...(config.optimizeDeps?.exclude ?? []), 'react-native-svg'],
    };
    return mergeConfig(config, {
    // Expo's public/index.html must not overwrite Storybook's manager page.
    publicDir: false,
    resolve: {
      extensions: ['.web.mjs', '.mjs', '.web.js', '.js', '.web.ts', '.ts', '.web.tsx', '.tsx', '.json'],
      alias: {
        'lucide-react-native': 'lucide-react',
        'react-native-svg': resolve(process.cwd(), 'stories/support/svg.web.tsx'),
        '@react-native/assets-registry/registry': resolve(process.cwd(), 'node_modules/react-native-web/dist/modules/AssetRegistry/index.js'),
      },
    },
  });
  },
};
export default config;
