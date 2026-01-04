<template>
  <div class="settings-menu">
    <!-- Connection Status Indicator -->
    <v-tooltip location="bottom" :text="connectionTooltip">
      <template #activator="{ props }">
        <v-btn
          icon
          variant="text"
          size="small"
          class="settings-btn connection-btn"
          :class="connectionStatusClass"
          v-bind="props"
          @click="openSettingsDialog"
        >
          <!-- Google Drive Connected: Show user avatar -->
          <template v-if="isGoogleConnected">
            <v-avatar size="22">
              <v-img v-if="googleDocs.userInfo.value?.picture" :src="googleDocs.userInfo.value.picture" />
              <v-icon v-else size="18">mdi-account</v-icon>
            </v-avatar>
          </template>
          <!-- Needs Reauthorization: Warning state -->
          <template v-else-if="needsReauthorization">
            <v-avatar size="22" color="warning">
              <v-img v-if="googleDocs.userInfo.value?.picture" :src="googleDocs.userInfo.value.picture" />
              <v-icon v-else size="18" color="white">mdi-account-alert</v-icon>
            </v-avatar>
          </template>
          <!-- Local Storage Mode -->
          <template v-else-if="isLocalMode">
            <v-icon size="20">mdi-laptop</v-icon>
          </template>
          <!-- Disconnected (Google mode but not connected) -->
          <template v-else>
            <v-icon size="20">mdi-cloud-off-outline</v-icon>
          </template>
        </v-btn>
      </template>
    </v-tooltip>

    <!-- PDF Export Button -->
    <v-tooltip location="bottom" text="Download as PDF">
      <template #activator="{ props }">
        <v-btn
          icon
          variant="text"
          size="small"
          class="settings-btn"
          v-bind="props"
          :loading="isExporting"
          :disabled="isExporting"
          @click="handlePdfExport"
        >
          <v-icon>mdi-file-pdf-box</v-icon>
        </v-btn>
      </template>
    </v-tooltip>

    <!-- Theme Toggle Button -->
    <v-tooltip location="bottom" :text="isDark ? 'Switch to light theme' : 'Switch to dark theme'">
      <template #activator="{ props }">
        <v-btn
          icon
          variant="text"
          size="small"
          class="settings-btn"
          v-bind="props"
          @click="toggleTheme"
        >
          <v-icon>{{ isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
        </v-btn>
      </template>
    </v-tooltip>

    <!-- Font Size Adjustment Menu -->
    <v-menu location="bottom end" :close-on-content-click="false" transition="scale-transition">
      <template #activator="{ props: menuProps }">
        <v-btn
          icon
          variant="text"
          size="small"
          class="settings-btn"
          title="Adjust font size"
          v-bind="menuProps"
        >
          <v-icon>mdi-format-size</v-icon>
        </v-btn>
      </template>
      <v-card min-width="280" class="popup-card">
        <v-card-title class="popup-title">
          <span>Font Size</span>
        </v-card-title>
        <v-card-text class="popup-content">
          <div class="font-size-controls">
            <!-- Slider Control -->
            <div class="d-flex align-center gap-4 mb-4">
               <v-slider
                v-model="localFontSize"
                :min="10"
                :max="24"
                :step="1"
                color="primary"
                track-color="grey-lighten-2"
                hide-details
                density="compact"
                thumb-size="16"
                @update:model-value="handleFontSizeChange"
              ></v-slider>
              <span class="font-weight-bold ml-2">{{ localFontSize }}px</span>
            </div>

            <!-- Quick Preset Buttons -->
            <div class="font-size-presets">
              <v-btn
                v-for="preset in fontSizePresets"
                :key="preset"
                size="x-small"
                :variant="localFontSize === preset ? 'flat' : 'outlined'"
                :color="localFontSize === preset ? 'primary' : undefined"
                class="preset-btn"
                @click="setFontSize(preset)"
              >
                {{ preset }}
              </v-btn>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-menu>

    <!-- Settings Button -->
    <v-tooltip location="bottom" text="Settings">
      <template #activator="{ props }">
        <v-btn
          icon
          variant="text"
          size="small"
          class="settings-btn"
          v-bind="props"
          @click="openSettingsDialog"
        >
          <v-icon>mdi-cog-outline</v-icon>
        </v-btn>
      </template>
    </v-tooltip>

    <!-- Help Button -->
    <v-tooltip location="bottom" text="Help">
      <template #activator="{ props }">
        <v-btn
          icon
          variant="text"
          size="small"
          class="settings-btn mr-1"
          v-bind="props"
          @click="showHelpDialog = true"
        >
          <v-icon>mdi-help-circle-outline</v-icon>
        </v-btn>
      </template>
    </v-tooltip>

    <!-- Help Dialog -->
    <v-dialog v-model="showHelpDialog" max-width="650" transition="dialog-bottom-transition">
      <v-card class="popup-card rounded-lg">
        <v-card-title class="popup-title d-flex align-center justify-space-between">
          <span class="text-h6 font-weight-bold">Help & Documentation</span>
          <v-btn icon variant="text" size="small" @click="showHelpDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        
        <v-card-text class="popup-content py-4">
          <div class="help-content">
            <div class="help-section mb-6">
                <h3 class="flex align-center gap-2 text-primary font-weight-bold mb-2">
                    <v-icon size="small" color="primary">mdi-information-outline</v-icon>
                    About This App
                </h3>
                <p>A real-time Markdown and Mermaid diagram preview tool. Edit Markdown on the left, and see the rendered result on the right instantly.</p>
            </div>

            <div class="help-section mb-6">
                <h3 class="flex align-center gap-2 text-primary font-weight-bold mb-2">
                    <v-icon size="small" color="primary">mdi-star-outline</v-icon>
                    Key Features
                </h3>
                <ul class="help-list">
                    <li><strong>Multi-tab Support</strong>: Create tabs, drag to reorder, and manage documents</li>
                    <li><strong>Batch Copy</strong>: Copy markdown content from all open tabs at once</li>
                    <li><strong>Mermaid Diagrams</strong>: Supports flowcharts, sequence diagrams, Gantt charts, etc.</li>
                    <li><strong>PDF Export</strong>: Download your preview as a PDF with one click</li>
                    <li><strong>Dark/Light Theme</strong>: Toggle between display themes</li>
                    <li><strong>Font Size Adjustment</strong>: Adjust font size from 10-24px</li>
                    <li><strong>AI Writing Assistant</strong>: Select text and right-click to improve or edit with AI (requires Gemini API key in Settings)</li>
                </ul>
            </div>

            <div class="help-section mb-6">
                <h3 class="flex align-center gap-2 text-primary font-weight-bold mb-2">
                    <v-icon size="small" color="primary">mdi-brain</v-icon>
                    Your Context Management Tool
                </h3>
                <p>Use tabs to organize conversation fragments, drag to sort them, and "Copy All" to merge context for re-prompting LLMs.</p>
            </div>

            <div class="help-section mb-6">
                <h3 class="flex align-center gap-2 text-primary font-weight-bold mb-2">
                    <v-icon size="small" color="primary">mdi-database-outline</v-icon>
                    Data Storage
                </h3>
                <v-alert type="info" variant="tonal" density="compact" class="info-alert">
                  <p class="mb-0 text-caption font-weight-medium">
                    All data is stored in your <strong>browser's local storage</strong>. Clearing browser data will result in data loss.
                  </p>
                </v-alert>
            </div>
          </div>
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions class="pa-4 bg-surface-hover">
          <v-btn
            variant="text"
            prepend-icon="mdi-github"
            href="https://github.com/kuochunchang/md-viewer"
            target="_blank"
            class="text-none"
          >
            GitHub Repository
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn variant="flat" color="primary" class="px-6" @click="showHelpDialog = false">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useGoogleDocs } from '../composables/useGoogleDocs'
import { usePdfExport } from '../composables/usePdfExport'
import { useSettingsStore } from '../stores/settingsStore'
import { useTabsStore } from '../stores/tabsStore'

const theme = useTheme()
const tabsStore = useTabsStore()
const settingsStore = useSettingsStore()
const googleDocs = useGoogleDocs()

// PDF Export
const { isExporting, exportPreviewToPdf } = usePdfExport()

// Connection Status
const isGoogleConnected = computed(() => 
  settingsStore.settings.provider === 'google' && googleDocs.isConnected.value
)

const needsReauthorization = computed(() => 
  settingsStore.settings.provider === 'google' && googleDocs.needsReauthorization.value
)

const isLocalMode = computed(() => 
  settingsStore.settings.provider === 'local'
)

const connectionTooltip = computed(() => {
  if (isGoogleConnected.value) {
    return `Connected to Google Drive as ${googleDocs.userInfo.value?.name || googleDocs.userInfo.value?.email}`
  } else if (needsReauthorization.value) {
    return 'Google session expired - Click to reconnect'
  } else if (isLocalMode.value) {
    return 'Using Local Storage'
  } else {
    return 'Not connected to Google Drive - Click to set up'
  }
})

const connectionStatusClass = computed(() => ({
  'connected': isGoogleConnected.value,
  'warning': needsReauthorization.value,
  'local': isLocalMode.value,
  'disconnected': !isGoogleConnected.value && !needsReauthorization.value && !isLocalMode.value
}))

// Theme state
const isDark = computed(() => theme.global.name.value === 'dark')

// Font size state
const fontSize = computed(() => tabsStore.fontSize)
const localFontSize = ref(fontSize.value)

// Font size presets
const fontSizePresets = [12, 14, 16, 18, 20]

// Help dialog state
const showHelpDialog = ref(false)

// Open Settings Dialog
function openSettingsDialog() {
  settingsStore.openSettingsDialog()
}

// Watch for external font size changes
watch(fontSize, (newValue) => {
  localFontSize.value = newValue
})

// Handle PDF Export
async function handlePdfExport() {
  try {
    const tabName = tabsStore.activeTab?.name || 'document'
    await exportPreviewToPdf('.preview-content', tabName)
  } catch (error) {
    console.error('PDF export failed:', error)
  }
}

// Toggle Theme - Using Vuetify 3 theme API
function toggleTheme() {
  const newTheme = isDark.value ? 'light' : 'dark'
  // Check if Vuetify 3.4+ change method is available
  if (typeof (theme as unknown as { change?: (name: string) => void }).change === 'function') {
    (theme as unknown as { change: (name: string) => void }).change(newTheme)
  } else {
    // Fallback for older Vuetify versions
    theme.global.name.value = newTheme
  }
  localStorage.setItem('theme', newTheme)
}

// Handle font size change
function handleFontSizeChange(value: number | string) {
  const numValue = typeof value === 'string' ? parseInt(value, 10) : value
  if (!isNaN(numValue) && numValue >= 10 && numValue <= 24) {
    tabsStore.setFontSize(numValue)
  }
}

// Set font size (preset)
function setFontSize(size: number) {
  tabsStore.setFontSize(size)
}

// Initialization: Load theme preference from localStorage
const savedTheme = localStorage.getItem('theme')
if (savedTheme === 'dark' || savedTheme === 'light') {
  // Check if Vuetify 3.4+ change method is available
  if (typeof (theme as unknown as { change?: (name: string) => void }).change === 'function') {
    (theme as unknown as { change: (name: string) => void }).change(savedTheme)
  } else {
    // Fallback for older Vuetify versions
    theme.global.name.value = savedTheme
  }
}
</script>

<style scoped lang="scss">
.settings-menu {
  display: flex;
  align-items: center;
  gap: 2px;
}

.settings-btn {
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  transition: all 0.2s;
  
  &:hover {
    color: var(--text-primary);
    background-color: var(--bg-surface-hover);
  }
}

// Connection Status Button Styles
.connection-btn {
  position: relative;
  
  &.connected {
    .v-avatar {
      border: 2px solid #4caf50;
      border-radius: 50%;
    }
  }
  
  &.warning {
    .v-avatar {
      border: 2px solid #ff9800;
      border-radius: 50%;
      animation: pulse-warning 2s infinite;
    }
  }
  
  &.local {
    color: var(--text-secondary);
  }
  
  &.disconnected {
    color: var(--text-tertiary);
    opacity: 0.7;
  }
}

@keyframes pulse-warning {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.4);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(255, 152, 0, 0);
  }
}

.popup-card {
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
  border-radius: var(--radius-lg) !important;
}

.popup-title {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  font-size: 1rem;
  font-weight: 600;
}

.popup-content {
  padding: 1.5rem;
  
  h3 {
    font-size: 0.95rem;
    color: var(--text-primary);
  }
  
  p, li {
    font-size: 0.9rem;
    color: var(--text-secondary);
    line-height: 1.6;
  }
}

.font-size-presets {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;

  .preset-btn {
    min-width: 40px;
    border-radius: var(--radius-sm);
  }
}

.help-list {
  padding-left: 1.25rem;
  li {
    margin-bottom: 0.5rem;
  }
}

// Responsive Design
@media (max-width: 600px) {
  .settings-menu {
    gap: 0;
  }
}
</style>
