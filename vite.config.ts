import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import path from 'path';

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ['src/**/*.vue', 'src/**/*.ts', 'index.ts'],
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'index.ts'),
      name: 'VueMediaDefer',
      fileName: (format) => `vue-media-defer.${format}.js`,
    },
    rollupOptions: {
      // 必须把 vue 和 vue-demi 都排除掉
      external: ['vue', 'vue-demi', '@vue/composition-api'],
      output: {
        // 在 UMD 模式下，告诉浏览器这些变量去全局找
        globals: {
          vue: 'Vue',
          'vue-demi': 'VueDemi',
        },
      },
    },
  },
});
