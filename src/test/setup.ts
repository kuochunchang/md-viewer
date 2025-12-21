import { config } from '@vue/test-utils'
import { createVuetify } from 'vuetify'

// 配置 Vuetify 用於測試環境（使用最小配置避免 CSS 導入問題）
const vuetify = createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#1976d2',
        },
      },
      dark: {
        colors: {
          primary: '#2196f3',
        },
      },
    },
  },
})

// 全域配置 Vue Test Utils
config.global.plugins = [vuetify]
