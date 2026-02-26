import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import path from 'path';

export default defineConfig({
  plugins: [
    vue(),
    dts({ include: ['src/**/*.vue', 'index.ts'] }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'index.ts'),
      name: 'VueMediaDefer',
      fileName: (format) => `vue-media-defer.${format}.js`,
    },
    rollupOptions: {
      external: ['vue', 'vue-demi'],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
          'vue-demi': 'VueDemi',
        },
      },
    },
  },
});
