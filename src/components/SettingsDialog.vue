<template>
  <v-dialog 
    v-model="isOpen" 
    max-width="550" 
    transition="dialog-bottom-transition"
    persistent
  >
    <v-card class="settings-dialog-card">
      <!-- Header -->
      <v-card-title class="dialog-header d-flex align-center justify-space-between">
        <div class="d-flex align-center gap-2">
          <v-icon color="primary">mdi-cog</v-icon>
          <span class="text-h6 font-weight-bold">Settings</span>
        </div>
        <v-btn icon variant="text" size="small" @click="closeDialog">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider></v-divider>

      <v-card-text class="dialog-content pa-0">
        <!-- Data Storage Section -->
        <div class="settings-section">
          <div class="section-header">
            <v-icon size="small" color="primary" class="mr-2">mdi-database</v-icon>
            <span class="section-title">Data Storage</span>
          </div>
          
          <div class="section-content">
            <!-- Local Storage Info -->
            <v-alert 
              type="info" 
              variant="tonal" 
              density="compact"
              class="mb-3"
            >
              <p class="mb-0 text-caption">
                Data is stored in your browser's <strong>localStorage</strong>.
                Clearing browser data will result in data loss.
              </p>
            </v-alert>

            <!-- Git Sync Hint -->
            <v-alert 
              type="success" 
              variant="tonal" 
              density="compact"
            >
              <div class="d-flex align-center gap-2">
                <v-icon size="18">mdi-git</v-icon>
                <span class="text-caption">
                  For backup and sync, configure <strong>Git Sync</strong> in the sidebar.
                </span>
              </div>
            </v-alert>
          </div>
        </div>

        <v-divider></v-divider>

        <!-- AI Assistant Section -->
        <div class="settings-section">
          <div class="section-header">
            <v-icon size="small" color="primary" class="mr-2">mdi-robot</v-icon>
            <span class="section-title">AI Assistant</span>
          </div>
          
          <div class="section-content">
            <!-- API Key Input -->
            <div class="setting-item flex-column">
              <div class="setting-label w-100 mb-2">
                <span class="setting-name">Gemini API Key</span>
                <span class="setting-description">
                  <a href="https://aistudio.google.com/apikey" target="_blank" class="text-primary">
                    Get from Google AI Studio
                    <v-icon size="12">mdi-open-in-new</v-icon>
                  </a>
                </span>
              </div>
              <v-text-field
                v-model="geminiApiKeyInput"
                :type="showGeminiApiKey ? 'text' : 'password'"
                placeholder="Enter your Gemini API Key"
                variant="outlined"
                density="compact"
                hide-details
                class="w-100"
              >
                <template #append-inner>
                  <v-btn
                    icon
                    variant="text"
                    size="x-small"
                    @click="showGeminiApiKey = !showGeminiApiKey"
                  >
                    <v-icon size="18">{{ showGeminiApiKey ? 'mdi-eye-off' : 'mdi-eye' }}</v-icon>
                  </v-btn>
                </template>
              </v-text-field>
            </div>

            <!-- Action Buttons -->
            <div class="setting-item d-flex gap-2 mt-3">
              <v-btn 
                color="primary" 
                variant="tonal"
                size="small"
                :disabled="!geminiApiKeyInput"
                :loading="isTestingGeminiKey"
                @click="handleSaveGeminiKey"
              >
                <v-icon start size="16">mdi-content-save</v-icon>
                Save Key
              </v-btn>
              <v-btn 
                color="secondary" 
                variant="tonal"
                size="small"
                :disabled="!geminiAI.isApiKeySet.value"
                :loading="isTestingGeminiKey"
                @click="handleTestGeminiKey"
              >
                <v-icon start size="16">mdi-connection</v-icon>
                Test Connection
              </v-btn>
              <v-btn 
                v-if="geminiAI.isApiKeySet.value"
                color="error" 
                variant="text"
                size="small"
                @click="handleClearGeminiKey"
              >
                <v-icon start size="16">mdi-delete</v-icon>
                Clear
              </v-btn>
            </div>

            <!-- Status Indicator -->
            <div class="mt-3">
              <v-chip 
                v-if="geminiAI.isApiKeySet.value"
                color="success" 
                size="small" 
                variant="tonal"
              >
                <v-icon start size="14">mdi-check-circle</v-icon>
                API Key Configured
              </v-chip>
              <v-chip 
                v-else
                color="grey" 
                size="small" 
                variant="tonal"
              >
                <v-icon start size="14">mdi-key-off</v-icon>
                No API Key
              </v-chip>
            </div>

            <!-- Test Result -->
            <v-alert 
              v-if="geminiTestResult !== null"
              :type="geminiTestResult ? 'success' : 'error'" 
              variant="tonal" 
              density="compact"
              class="mt-3"
              closable
              @click:close="geminiTestResult = null"
            >
              {{ geminiTestResult ? 'API connection successful!' : 'Connection failed. Please check your API key.' }}
            </v-alert>

            <!-- Usage Info -->
            <v-alert type="info" variant="tonal" density="compact" class="mt-3">
              <p class="text-caption mb-0">
                <strong>How to use:</strong> Select text in the editor, then right-click to access AI features like text improvement and AI-assisted editing.
              </p>
            </v-alert>
          </div>
        </div>

        <v-divider></v-divider>

        <!-- Security Section -->
        <div class="settings-section">
          <div class="section-header">
            <v-icon size="small" color="primary" class="mr-2">mdi-shield-check</v-icon>
            <span class="section-title">Security</span>
          </div>
          
          <div class="section-content">
            <v-alert type="success" variant="tonal" density="compact">
              <div class="d-flex align-start gap-2">
                <v-icon size="20">mdi-lock-outline</v-icon>
                <div>
                  <p class="mb-1 font-weight-medium">Your Data is Secure</p>
                  <ul class="security-list text-caption">
                    <li>All data is stored only in your browser</li>
                    <li>No personal info or credentials are stored on any servers</li>
                    <li>API keys are stored locally in your browser</li>
                  </ul>
                </div>
              </div>
            </v-alert>
          </div>
        </div>
      </v-card-text>

      <v-divider></v-divider>

      <!-- Footer Actions -->
      <v-card-actions class="dialog-actions pa-4">
        <v-spacer></v-spacer>
        <v-btn variant="flat" color="primary" @click="closeDialog">
          Close
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGeminiAI } from '../composables/useGeminiAI'
import { useSettingsStore } from '../stores/settingsStore'

const settingsStore = useSettingsStore()
const geminiAI = useGeminiAI()

// Dialog state
const isOpen = computed({
  get: () => settingsStore.isSettingsDialogOpen,
  set: (val) => {
    if (!val) settingsStore.closeSettingsDialog()
  }
})

// Gemini AI state
const geminiApiKeyInput = ref(geminiAI.getApiKey() || '')
const showGeminiApiKey = ref(false)
const isTestingGeminiKey = ref(false)
const geminiTestResult = ref<boolean | null>(null)

// Actions
function closeDialog() {
  settingsStore.closeSettingsDialog()
}

// Gemini AI handlers
function handleSaveGeminiKey() {
  if (geminiApiKeyInput.value) {
    geminiAI.setApiKey(geminiApiKeyInput.value)
    geminiTestResult.value = null
  }
}

async function handleTestGeminiKey() {
  isTestingGeminiKey.value = true
  geminiTestResult.value = null
  
  try {
    const success = await geminiAI.testConnection()
    geminiTestResult.value = success
  } catch (e) {
    geminiTestResult.value = false
  } finally {
    isTestingGeminiKey.value = false
  }
}

function handleClearGeminiKey() {
  geminiAI.clearApiKey()
  geminiApiKeyInput.value = ''
  geminiTestResult.value = null
}
</script>

<style scoped lang="scss">
.settings-dialog-card {
  border-radius: var(--radius-lg) !important;
  overflow: hidden;
}

.dialog-header {
  padding: 1rem 1.25rem;
  background: var(--bg-surface);
}

.dialog-content {
  max-height: 65vh;
  overflow-y: auto;
}

.settings-section {
  padding: 1.25rem;
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.section-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
}

.section-content {
  padding-left: 0.25rem;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  gap: 1rem;
  
  &:not(:last-child) {
    border-bottom: 1px solid var(--border-color-light);
  }
}

.setting-label {
  flex: 1;
  min-width: 0;
}

.setting-name {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.125rem;
}

.setting-description {
  display: block;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  
  a {
    text-decoration: none;
    &:hover {
      text-decoration: underline;
    }
  }
}

.security-list {
  margin: 0;
  padding-left: 1.25rem;
  
  li {
    margin-bottom: 0.25rem;
    color: var(--text-secondary);
    
    &:last-child {
      margin-bottom: 0;
    }
  }
}

.dialog-actions {
  background: var(--bg-surface);
}

// Responsive
@media (max-width: 500px) {
  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>
