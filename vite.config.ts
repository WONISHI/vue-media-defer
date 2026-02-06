import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import path from 'path';

export default defineConfig({
  plugins: [
    vue(),
   dts({
      entryRoot: '.', 
      outDir: 'dist',
      include: ['src/**/*.vue', 'src/**/*.ts', 'index.ts'],
      beforeWriteFile: (filePath, content) => {
        const _content = content.replace(/vue-demi/g, 'vue')
        return {
          filePath,
          content: _content
        }
      }
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'index.ts'),
      name: 'VueMediaDefer',
      fileName: (format) => `vue-media-defer.${format}.js`,
    },
    rollupOptions: {
      external: ['vue', 'vue-demi', '@vue/composition-api'], 
      output: {
        globals: {
          vue: 'Vue',
          'vue-demi': 'VueDemi',
          '@vue/composition-api': 'VueCompositionAPI'
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});