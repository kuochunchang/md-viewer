<template>
  <div class="settings-menu">
    <!-- PDF Export Button -->
    <v-btn
      icon
      variant="text"
      size="small"
      class="pdf-export-btn"
      title="Download as PDF"
      :loading="isExporting"
      :disabled="isExporting"
      @click="handlePdfExport"
    >
      <v-icon>mdi-file-pdf-box</v-icon>
    </v-btn>

    <!-- Theme Toggle Button -->
    <v-btn
      icon
      variant="text"
      size="small"
      class="theme-toggle-btn"
      :title="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
      @click="toggleTheme"
    >
      <v-icon>{{ isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
    </v-btn>

    <!-- Font Size Adjustment Menu -->
    <v-menu location="bottom end" :close-on-content-click="false">
      <template #activator="{ props: menuProps }">
        <v-btn
          icon
          variant="text"
          size="small"
          class="font-size-btn"
          title="Adjust font size"
          v-bind="menuProps"
        >
          <v-icon>mdi-format-size</v-icon>
        </v-btn>
      </template>
      <v-card min-width="280" class="font-size-menu">
        <v-card-title class="text-subtitle-1 pa-4 pb-2">
          Font Size
        </v-card-title>
        <v-card-text class="pt-2">
          <div class="font-size-controls">
            <!-- Font Size Display -->
            <div class="font-size-display mb-4">
              <span class="text-body-2">Current size: {{ fontSize }}px</span>
            </div>

            <!-- Slider Control -->
            <v-slider
              v-model="localFontSize"
              :min="10"
              :max="24"
              :step="1"
              color="primary"
              track-color="grey-lighten-2"
              hide-details
              @update:model-value="handleFontSizeChange"
            >
              <template #append>
                <v-text-field
                  v-model.number="localFontSize"
                  type="number"
                  variant="outlined"
                  density="compact"
                  style="width: 70px"
                  :min="10"
                  :max="24"
                  hide-details
                  @update:model-value="handleFontSizeChange"
                ></v-text-field>
              </template>
            </v-slider>

            <!-- Quick Preset Buttons -->
            <div class="font-size-presets mt-4">
              <v-btn
                v-for="preset in fontSizePresets"
                :key="preset"
                size="small"
                variant="outlined"
                :color="localFontSize === preset ? 'primary' : undefined"
                class="preset-btn"
                @click="setFontSize(preset)"
              >
                {{ preset }}px
              </v-btn>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-menu>

    <!-- Help Button -->
    <v-btn
      icon
      variant="text"
      size="small"
      class="help-btn"
      title="Help"
      @click="showHelpDialog = true"
    >
      <v-icon>mdi-help-circle-outline</v-icon>
    </v-btn>

    <!-- Help Dialog -->
    <v-dialog v-model="showHelpDialog" max-width="650">
      <v-card class="help-dialog">
        <v-card-title class="d-flex align-center justify-space-between py-3">
          <span class="text-subtitle-1 font-weight-medium">📖 Help</span>
          <v-btn icon variant="text" size="x-small" @click="showHelpDialog = false">
            <v-icon size="small">mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        
        <v-card-text class="pt-0">
          <div class="help-content">
            <h3 class="text-subtitle-2 font-weight-bold mb-1">🎯 About This App</h3>
            <p class="mb-3 text-body-2">
              A real-time Markdown and Mermaid diagram preview tool. Edit Markdown on the left, and see the rendered result on the right instantly.
            </p>

            <h3 class="text-subtitle-2 font-weight-bold mb-1">✨ Key Features</h3>
            <ul class="help-list mb-3">
              <li><strong>Multi-tab Support</strong>: Create multiple tabs to manage different documents</li>
              <li><strong>Mermaid Diagrams</strong>: Supports flowcharts, sequence diagrams, Gantt charts, etc.</li>
              <li><strong>PDF Export</strong>: Download your preview as a PDF with one click</li>
              <li><strong>Dark/Light Theme</strong>: Toggle between display themes</li>
              <li><strong>Font Size Adjustment</strong>: Adjust font size from 10-24px</li>
            </ul>

            <h3 class="text-subtitle-2 font-weight-bold mb-1">💾 Data Storage</h3>
            <v-alert type="info" variant="tonal" density="compact" class="mb-3">
              <p class="mb-0 text-body-2">
                All data (including tab contents and settings) is stored in the <strong>browser's local storage (localStorage)</strong>.
              </p>
              <p class="mb-0 mt-1 text-body-2">
                This means your data only exists in this browser. Clearing browser data will result in data loss.
              </p>
            </v-alert>

            <h3 class="text-subtitle-2 font-weight-bold mb-1">⌨️ Quick Tips</h3>
            <ul class="help-list mb-2">
              <li>Double-click a tab name to edit it</li>
              <li>Drag the divider to adjust panel ratio</li>
              <li>Click the menu icon (top-left) to show/hide the file list</li>
            </ul>
          </div>
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions class="pa-3">
          <v-btn
            variant="outlined"
            color="primary"
            size="small"
            href="https://github.com/kuochunchang/md-viewer"
            target="_blank"
            prepend-icon="mdi-github"
          >
            GitHub
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn variant="flat" color="primary" size="small" @click="showHelpDialog = false">
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
import { usePdfExport } from '../composables/usePdfExport'
import { useTabsStore } from '../stores/tabsStore'

const theme = useTheme()
const tabsStore = useTabsStore()

// PDF Export
const { isExporting, exportPreviewToPdf } = usePdfExport()

// Theme state
const isDark = computed(() => theme.global.name.value === 'dark')

// Font size state
const fontSize = computed(() => tabsStore.fontSize)
const localFontSize = ref(fontSize.value)

// Font size presets
const fontSizePresets = [12, 14, 16, 18, 20]

// Help dialog state
const showHelpDialog = ref(false)

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
    // Could add a snackbar notification here in the future
  }
}

// Toggle Theme
function toggleTheme() {
  theme.global.name.value = isDark.value ? 'light' : 'dark'
  // Save theme preference to localStorage
  localStorage.setItem('theme', theme.global.name.value)
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
  theme.global.name.value = savedTheme
}
</script>

<style scoped lang="scss">
.settings-menu {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding-right: 8px;
}

.pdf-export-btn,
.theme-toggle-btn,
.font-size-btn,
.help-btn {
  flex-shrink: 0;
}

.font-size-menu {
  .font-size-controls {
    .font-size-display {
      text-align: center;
      color: rgba(var(--v-theme-on-surface), 0.7);
    }

    .font-size-presets {
      display: flex;
      gap: 8px;
      justify-content: center;
      flex-wrap: wrap;

      .preset-btn {
        min-width: 60px;
      }
    }
  }
}

.help-dialog {
  .help-content {
    h3 {
      color: rgba(var(--v-theme-on-surface), 0.87);
      font-size: 0.875rem;
    }

    p {
      color: rgba(var(--v-theme-on-surface), 0.7);
      line-height: 1.5;
      font-size: 0.8125rem;
    }

    .help-list {
      padding-left: 18px;
      color: rgba(var(--v-theme-on-surface), 0.7);
      font-size: 0.8125rem;

      li {
        margin-bottom: 4px;
        line-height: 1.4;
      }
    }
  }
}

// Responsive Design: Adjust button size on small screens
@media (max-width: 600px) {
  .settings-menu {
    gap: 2px;
    padding-right: 4px;
  }

  .pdf-export-btn,
  .theme-toggle-btn,
  .font-size-btn,
  .help-btn {
    :deep(.v-btn) {
      width: 36px;
      height: 36px;
    }
  }
}
</style>
