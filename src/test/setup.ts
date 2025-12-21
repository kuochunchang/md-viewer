import { config } from '@vue/test-utils'
import { createVuetify } from 'vuetify'

// Configure Vuetify for testing environment (use minimal config to avoid CSS import issues)
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

// Global configuration for Vue Test Utils
config.global.plugins = [vuetify]
