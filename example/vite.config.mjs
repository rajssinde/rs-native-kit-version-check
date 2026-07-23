import { defineConfig, mergeConfig } from 'vite';

import config from 'react-native-builder-bob/vite-config';
import pack from '../package.json' with { type: 'json' };

export default defineConfig((env) =>
  mergeConfig(config(env), {
    resolve: {
      alias: {
        [`${pack.name}/ui`]: new URL('../src/ui.tsx', import.meta.url),
        [pack.name]: new URL('..', import.meta.url),
      },
      conditions: ['rs-native-kit-version-check-source'],
      dedupe: Object.keys(pack.peerDependencies),
    },
  })
);
