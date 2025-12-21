import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import type { Plugin } from 'vite'

// 自定義插件處理 CSS 檔案
const cssMockPlugin = (): Plugin => ({
  name: 'css-mock',
  enforce: 'pre',
  resolveId(id) {
    // 攔截所有 CSS 和 SCSS 檔案，包括 node_modules 中的
    if (id.endsWith('.css') || id.endsWith('.scss')) {
      return id
    }
    return null
  },
  load(id) {
    // 處理所有 CSS 檔案
    if (id.endsWith('.css') || id.endsWith('.scss')) {
      return 'export default {}'
    }
    return null
  },
})

export default defineConfig({
  plugins: [cssMockPlugin(), vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json', '.vue'],
  },
  css: {
    modules: {
      classNameStrategy: 'non-scoped',
    },
  },
})
