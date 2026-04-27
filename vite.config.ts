import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    vue(),
    dts({
      beforeWriteFile: (filePath, content) => {
        const _content = content.replace(/vue-demi/g, 'vue');
        return {
          filePath,
          content: _content,
        };
      },
    }),
  ],
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    lib: {
      entry: resolve(__dirname, './index.ts'),
      name: 'VueMediaDefer',
      fileName: 'vue-media-defer',
      formats: ['es', 'umd', 'cjs', 'iife'],
    },
    rollupOptions: {
      // 确保外部化处理那些你不想打包进库的依赖
      external: ['vue', 'vue-demi'], 
      output: {
        // 在 UMD 构建模式下为这些外部化的依赖提供一个全局变量
        globals: {
          vue: 'Vue',
          'vue-demi': 'VueDemi',
        },
      },
    },
  },
});