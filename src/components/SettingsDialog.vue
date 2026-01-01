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
        <!-- Storage Settings Section -->
        <div class="settings-section">
          <div class="section-header">
            <v-icon size="small" color="primary" class="mr-2">mdi-cloud-sync</v-icon>
            <span class="section-title">Data Storage</span>
          </div>
          
          <div class="section-content">
            <!-- Storage Provider Selection -->
            <div class="setting-item">
              <div class="setting-label">
                <span class="setting-name">Storage Location</span>
                <span class="setting-description">Choose where to store your data</span>
              </div>
              <v-btn-toggle 
                v-model="localSettings.provider" 
                mandatory 
                density="compact"
                class="provider-toggle"
              >
                <v-btn value="local" size="small" :color="localSettings.provider === 'local' ? 'primary' : undefined">
                  <v-icon start size="18">mdi-laptop</v-icon>
                  Local
                </v-btn>
                <v-btn value="google" size="small" :color="localSettings.provider === 'google' ? 'primary' : undefined">
                  <v-icon start size="18">mdi-google-drive</v-icon>
                  Google Drive
                </v-btn>
              </v-btn-toggle>
            </div>

            <!-- Google Drive 設定 -->
            <v-expand-transition>
              <div v-if="localSettings.provider === 'google'" class="google-settings">
                <!-- Connection Status -->
                <div class="setting-item connection-status">
                  <div class="setting-label">
                    <span class="setting-name">Connection Status</span>
                  </div>
                  <div class="status-indicator">
                    <template v-if="googleDocs.isConnected.value">
                      <v-chip color="success" size="small" variant="tonal">
                        <v-avatar start size="24">
                          <v-img v-if="googleDocs.userInfo.value?.picture" :src="googleDocs.userInfo.value.picture" />
                          <v-icon v-else>mdi-account</v-icon>
                        </v-avatar>
                        {{ googleDocs.userInfo.value?.name || googleDocs.userInfo.value?.email }}
                      </v-chip>
                      <v-btn 
                        size="x-small" 
                        variant="text" 
                        color="error" 
                        class="ml-2"
                        @click="handleSignOut"
                      >
                        Sign Out
                      </v-btn>
                    </template>
                    <template v-else-if="googleDocs.needsReauthorization.value">
                      <v-chip color="warning" size="small" variant="tonal">
                        <v-avatar start size="24">
                          <v-img v-if="googleDocs.userInfo.value?.picture" :src="googleDocs.userInfo.value.picture" />
                          <v-icon v-else>mdi-account</v-icon>
                        </v-avatar>
                        {{ googleDocs.userInfo.value?.name || googleDocs.userInfo.value?.email }}
                      </v-chip>
                      <v-btn 
                        size="x-small" 
                        variant="tonal" 
                        color="warning" 
                        class="ml-2"
                        :loading="isSigningIn"
                        @click="handleReauthorize"
                      >
                        <v-icon start size="14">mdi-refresh</v-icon>
                        Reconnect
                      </v-btn>
                    </template>
                    <template v-else>
                      <v-chip color="grey" size="small" variant="tonal">
                        <v-icon start size="16">mdi-cloud-off-outline</v-icon>
                        Disconnected
                      </v-chip>
                    </template>
                  </div>
                </div>

                <!-- Google Client ID Settings -->
                <div class="setting-item flex-column" v-if="!googleDocs.isConnected.value">
                  <div class="setting-label w-100 mb-2">
                    <span class="setting-name">Google Client ID</span>
                    <span class="setting-description">
                      <a href="https://console.cloud.google.com/apis/credentials" target="_blank" class="text-primary">
                        Get from Google Cloud Console
                        <v-icon size="12">mdi-open-in-new</v-icon>
                      </a>
                    </span>
                  </div>
                  <v-text-field
                    v-model="clientIdInput"
                    placeholder="Enter your Client ID"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="w-100 mb-2"
                  ></v-text-field>
                  
                  <!-- Redirect URI Hint -->
                  <v-alert 
                    type="warning" 
                    variant="tonal" 
                    density="compact"
                    class="w-100 mt-2"
                  >
                    <div class="text-caption">
                      <strong>Important:</strong> Please add the following URLs to your OAuth Client settings in Google Cloud Console:
                      <div class="mt-1">
                        <strong>Authorized JavaScript origins:</strong>
                        <code class="ml-1">{{ currentOrigin }}</code>
                      </div>
                      <div class="mt-1">
                        <strong>Authorized redirect URIs:</strong>
                        <code class="ml-1">{{ redirectUri }}</code>
                      </div>
                    </div>
                  </v-alert>
                </div>

                <!-- Sign In Button -->
                <div class="setting-item" v-if="!googleDocs.isConnected.value">
                  <v-btn 
                    color="primary" 
                    variant="flat"
                    :disabled="!clientIdInput"
                    :loading="isSigningIn"
                    @click="handleSignIn"
                    block
                  >
                    <v-icon start>mdi-google</v-icon>
                    Connect Google Account
                  </v-btn>
                </div>

                <!-- Auto Sync Settings -->
                <template v-if="googleDocs.isConnected.value">
                  <div class="setting-item">
                    <div class="setting-label">
                      <span class="setting-name">Auto Sync</span>
                      <span class="setting-description">Automatically sync data to cloud</span>
                    </div>
                    <v-switch
                      v-model="localSettings.autoSync"
                      color="primary"
                      hide-details
                      density="compact"
                    ></v-switch>
                  </div>

                  <v-expand-transition>
                    <div v-if="localSettings.autoSync" class="setting-item">
                      <div class="setting-label">
                        <span class="setting-name">Sync Interval</span>
                        <span class="setting-description">How often to sync</span>
                      </div>
                      <v-select
                        v-model="localSettings.syncIntervalMinutes"
                        :items="syncIntervalOptions"
                        item-title="text"
                        item-value="value"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="sync-interval-select"
                      ></v-select>
                    </div>
                  </v-expand-transition>

                  <!-- Backup Settings -->
                  <div class="setting-item">
                    <div class="setting-label">
                      <span class="setting-name">Daily Backup</span>
                      <span class="setting-description">Create daily backups before sync</span>
                    </div>
                    <v-switch
                      v-model="localSettings.backupEnabled"
                      color="primary"
                      hide-details
                      density="compact"
                    ></v-switch>
                  </div>

                  <v-expand-transition>
                    <div v-if="localSettings.backupEnabled">
                      <div class="setting-item">
                        <div class="setting-label">
                          <span class="setting-name">Retention Days</span>
                          <span class="setting-description">Keep backups for</span>
                        </div>
                        <v-select
                          v-model="localSettings.backupRetentionDays"
                          :items="retentionDaysOptions"
                          item-title="text"
                          item-value="value"
                          variant="outlined"
                          density="compact"
                          hide-details
                          class="retention-days-select"
                        ></v-select>
                      </div>

                      <!-- Backup Files List -->
                      <div v-if="backupFilesList.length > 0" class="backup-section">
                        <div class="setting-label mb-2">
                          <span class="setting-name">Available Backups ({{ backupFilesList.length }})</span>
                          <v-btn
                            icon
                            variant="text"
                            size="x-small"
                            :loading="isLoadingBackups"
                            @click="refreshBackups"
                          >
                            <v-icon size="16">mdi-refresh</v-icon>
                          </v-btn>
                        </div>
                        <v-list density="compact" class="backup-list rounded-lg">
                          <v-list-item
                            v-for="backup in displayedBackups"
                            :key="backup.id"
                            class="backup-item"
                          >
                            <template #prepend>
                              <v-icon color="primary" size="small">mdi-file-document</v-icon>
                            </template>
                            <v-list-item-title class="text-body-2">
                              {{ backup.date }}
                            </v-list-item-title>
                            <v-list-item-subtitle class="text-caption">
                              {{ formatTime(new Date(backup.modifiedTime).getTime()) }}
                            </v-list-item-subtitle>
                            <template #append>
                              <v-btn
                                variant="text"
                                size="x-small"
                                color="warning"
                                @click="handleRestoreBackup(backup)"
                              >
                                Restore
                              </v-btn>
                            </template>
                          </v-list-item>
                        </v-list>
                        <!-- Show More/Less Button -->
                        <v-btn
                          v-if="hasMoreBackups"
                          variant="text"
                          size="x-small"
                          color="primary"
                          class="mt-2"
                          @click="showAllBackups = !showAllBackups"
                        >
                          <v-icon start size="14">{{ showAllBackups ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                          {{ showAllBackups ? 'Show Less' : `Show ${backupFilesList.length - MAX_VISIBLE_BACKUPS} More` }}
                        </v-btn>
                      </div>

                      <v-alert
                        type="info"
                        variant="tonal"
                        density="compact"
                        class="mt-2"
                      >
                        <p class="text-caption mb-0">
                          A backup is created each day before the first sync. Backups older than {{ localSettings.backupRetentionDays }} days are auto-deleted.
                        </p>
                      </v-alert>
                    </div>
                  </v-expand-transition>

                  <!-- Migration Prompt (shown when cloud file doesn't exist) -->
                  <v-alert 
                    v-if="shouldOfferMigration && localDataStats.tabCount > 0"
                    type="info" 
                    variant="tonal" 
                    density="compact"
                    class="mb-3"
                  >
                    <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                      <div class="d-flex align-center gap-2">
                        <v-icon size="18">mdi-database-arrow-up</v-icon>
                        <span class="text-caption">
                          Detected {{ localDataStats.tabCount }} local files
                        </span>
                      </div>
                      <v-btn 
                        size="x-small" 
                        variant="flat" 
                        color="primary"
                        @click="showMigrationDialog = true"
                      >
                        Migrate to Cloud
                      </v-btn>
                    </div>
                  </v-alert>

                  <!-- Conflict Alert -->
                  <v-alert 
                    v-if="googleDocs.hasConflict.value"
                    type="warning" 
                    variant="tonal" 
                    density="compact"
                    class="mb-3"
                  >
                    <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                      <div class="d-flex align-center gap-2">
                        <v-icon size="18">mdi-sync-alert</v-icon>
                        <span class="text-caption">
                          Cloud has been updated on another device
                        </span>
                      </div>
                      <v-btn 
                        size="x-small" 
                        variant="flat" 
                        color="warning"
                        @click="showConflictDialog = true"
                      >
                        Resolve
                      </v-btn>
                    </div>
                  </v-alert>

                  <!-- Manual Sync Buttons -->
                  <div class="setting-item sync-actions">
                    <v-btn 
                      color="primary" 
                      variant="tonal"
                      size="small"
                      :loading="googleDocs.syncStatus.value.isSyncing"
                      :disabled="googleDocs.hasConflict.value"
                      @click="handleManualSync"
                    >
                      <v-icon start size="18">mdi-cloud-upload</v-icon>
                      Sync Now
                    </v-btn>
                    <v-btn 
                      color="secondary" 
                      variant="tonal"
                      size="small"
                      :loading="googleDocs.syncStatus.value.isSyncing"
                      :disabled="!googleDocs.hasSyncFile.value"
                      @click="handleLoadFromCloud"
                    >
                      <v-icon start size="18">mdi-cloud-download</v-icon>
                      Load from Cloud
                    </v-btn>
                    <v-btn 
                      color="success" 
                      variant="tonal"
                      size="small"
                      :loading="isCreatingBackup"
                      :disabled="!googleDocs.hasSyncFile.value || googleDocs.hasConflict.value"
                      @click="handleManualBackup"
                    >
                      <v-icon start size="18">mdi-backup-restore</v-icon>
                      Backup Now
                    </v-btn>
                  </div>

                  <!-- Last Sync Time -->
                  <div v-if="googleDocs.syncStatus.value.lastSyncTime" class="last-sync-time">
                    <v-icon size="14" class="mr-1">mdi-clock-outline</v-icon>
                    Last synced: {{ formatTime(googleDocs.syncStatus.value.lastSyncTime) }}
                  </div>

                  <!-- Sync Error -->
                  <v-alert 
                    v-if="googleDocs.syncStatus.value.error" 
                    type="error" 
                    variant="tonal" 
                    density="compact"
                    class="mt-3"
                  >
                    {{ googleDocs.syncStatus.value.error }}
                  </v-alert>
                </template>
              </div>
            </v-expand-transition>

            <!-- Local Storage Warning -->
            <v-alert 
              v-if="localSettings.provider === 'local'" 
              type="info" 
              variant="tonal" 
              density="compact"
              class="mt-3"
            >
              <p class="mb-0 text-caption">
                Data is stored in your browser's <strong>localStorage</strong>.
                Clearing browser data will result in data loss.
              </p>
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
                    <li>All login information is stored only in your browser</li>
                    <li>No personal info or credentials are stored on our servers</li>
                    <li>We only access files created by this application in your Google Drive</li>
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
        <v-btn variant="text" color="grey" @click="resetSettings">
          Reset to Defaults
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn variant="flat" color="primary" @click="saveAndClose">
          Save Settings
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Migration Dialog -->
  <v-dialog 
    v-model="showMigrationDialog" 
    max-width="450" 
    persistent
  >
    <v-card class="migration-dialog-card">
      <v-card-title class="dialog-header d-flex align-center gap-2">
        <v-icon color="primary">mdi-database-arrow-up</v-icon>
        <span class="text-h6 font-weight-bold">Data Migration</span>
      </v-card-title>

      <v-divider></v-divider>

      <v-card-text class="pa-5">
        <div class="migration-content">
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            <div class="d-flex align-center gap-2">
              <v-icon>mdi-information</v-icon>
              <span class="font-weight-medium">Local Data Detected</span>
            </div>
          </v-alert>

          <p class="text-body-2 mb-4">
            Your browser has <strong>{{ localDataStats.tabCount }} files</strong> 
            <span v-if="localDataStats.folderCount > 0">and <strong>{{ localDataStats.folderCount }} folders</strong></span>.
          </p>

          <p class="text-body-2 mb-4">
            Would you like to migrate this data to Google Drive?
          </p>

          <v-alert type="warning" variant="tonal" density="compact" class="mb-0">
            <p class="text-caption mb-0">
              <strong>Note:</strong> After migration, your data will exist both locally and in the cloud.
              Future changes will sync based on your storage settings.
            </p>
          </v-alert>
        </div>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-actions class="pa-4 d-flex gap-2">
        <v-btn 
          variant="text" 
          color="grey"
          @click="skipMigration"
        >
          Skip
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn 
          variant="flat" 
          color="primary"
          :loading="isMigrating"
          @click="performMigration"
        >
          <v-icon start>mdi-cloud-upload</v-icon>
          Start Migration
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Migration Success Snackbar -->
  <v-snackbar 
    v-model="showMigrationSuccess" 
    color="success" 
    :timeout="4000"
    location="top"
  >
    <div class="d-flex align-center gap-2">
      <v-icon>mdi-check-circle</v-icon>
      <span>Data successfully migrated to Google Drive!</span>
    </div>
  </v-snackbar>

  <!-- Migration Error Snackbar -->
  <v-snackbar 
    v-model="showMigrationError" 
    color="error" 
    :timeout="5000"
    location="top"
  >
    <div class="d-flex align-center gap-2">
      <v-icon>mdi-alert-circle</v-icon>
      <span>Migration failed: {{ migrationErrorMessage }}</span>
    </div>
  </v-snackbar>

  <!-- Backup Success Snackbar -->
  <v-snackbar 
    v-model="showBackupSuccess" 
    color="success" 
    :timeout="4000"
    location="top"
  >
    <div class="d-flex align-center gap-2">
      <v-icon>mdi-backup-restore</v-icon>
      <span>Backup created successfully!</span>
    </div>
  </v-snackbar>

  <!-- Backup Error Snackbar -->
  <v-snackbar 
    v-model="showBackupError" 
    color="error" 
    :timeout="5000"
    location="top"
  >
    <div class="d-flex align-center gap-2">
      <v-icon>mdi-alert-circle</v-icon>
      <span>Backup failed: {{ backupErrorMessage }}</span>
    </div>
  </v-snackbar>

  <!-- Conflict Dialog -->
  <v-dialog v-model="showConflictDialog" max-width="480" persistent>
    <v-card>
      <v-card-title class="text-h6 bg-warning text-white d-flex align-center gap-2">
        <v-icon icon="mdi-sync-alert" color="white"></v-icon>
        Sync Conflict Detected
      </v-card-title>
      <v-card-text class="pt-4">
        <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
          <p class="mb-0 text-body-2">
            The cloud file has been modified by another device since your last sync.
          </p>
        </v-alert>
        
        <p class="text-body-2 mb-3">Please choose how to resolve this conflict:</p>
        
        <div class="conflict-options">
          <v-card variant="outlined" class="mb-2 conflict-option" @click="handleLoadFromCloudConflict">
            <v-card-text class="d-flex align-center gap-3 py-3">
              <v-icon color="primary" size="24">mdi-cloud-download</v-icon>
              <div>
                <div class="font-weight-medium">Load from Cloud</div>
                <div class="text-caption text-grey">Replace local data with cloud version</div>
              </div>
            </v-card-text>
          </v-card>
          
          <v-card variant="outlined" class="mb-2 conflict-option" @click="confirmForceSync">
            <v-card-text class="d-flex align-center gap-3 py-3">
              <v-icon color="warning" size="24">mdi-cloud-upload</v-icon>
              <div>
                <div class="font-weight-medium">Overwrite Cloud</div>
                <div class="text-caption text-grey">Push local data to cloud (creates backup first)</div>
              </div>
            </v-card-text>
          </v-card>
        </div>
      </v-card-text>
      <v-card-actions class="pa-4 pt-0">
        <v-spacer></v-spacer>
        <v-btn variant="text" color="grey" @click="cancelConflict">Cancel</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useGeminiAI } from '../composables/useGeminiAI'
import { useGoogleDocs } from '../composables/useGoogleDocs'
import { useSettingsStore, type SyncSettings } from '../stores/settingsStore'
import { useTabsStore } from '../stores/tabsStore'

const settingsStore = useSettingsStore()
const googleDocs = useGoogleDocs()
const geminiAI = useGeminiAI()
const tabsStore = useTabsStore()

// Dialog state
const isOpen = computed({
  get: () => settingsStore.isSettingsDialogOpen,
  set: (val) => {
    if (!val) settingsStore.closeSettingsDialog()
  }
})

// OAuth URI helpers (for user guidance)
const currentOrigin = computed(() => window.location.origin)
const redirectUri = computed(() => window.location.origin + window.location.pathname)

// Local copy of settings for editing
const localSettings = ref<SyncSettings>({ ...settingsStore.settings })
const clientIdInput = ref(googleDocs.getClientId())
const isSigningIn = ref(false)

// Migration state
const showMigrationDialog = ref(false)
const isMigrating = ref(false)
const showMigrationSuccess = ref(false)
const showMigrationError = ref(false)
const migrationErrorMessage = ref('')
const showConflictDialog = ref(false) // Conflict dialog state

// Backup state
const isCreatingBackup = ref(false)
const showBackupSuccess = ref(false)
const showBackupError = ref(false)
const backupErrorMessage = ref('')

// Gemini AI state
const geminiApiKeyInput = ref(geminiAI.getApiKey() || '')
const showGeminiApiKey = ref(false)
const isTestingGeminiKey = ref(false)
const geminiTestResult = ref<boolean | null>(null)

// Local data stats for migration dialog
const localDataStats = computed(() => ({
  tabCount: tabsStore.tabs.length,
  folderCount: tabsStore.folders.length
}))

// Check if local data exists and migration is needed
const shouldOfferMigration = computed(() => {
  return tabsStore.tabs.length > 0 && 
         googleDocs.isConnected.value && 
         !googleDocs.hasSyncFile.value
})

// Sync interval options
const syncIntervalOptions = [
  { text: '1 Minute', value: 1 },
  { text: '5 Minutes', value: 5 },
  { text: '10 Minutes', value: 10 },
  { text: '15 Minutes', value: 15 },
  { text: '30 Minutes', value: 30 },
  { text: '1 Hour', value: 60 }
]

// Backup retention days options
const retentionDaysOptions = [
  { text: '3 Days', value: 3 },
  { text: '5 Days', value: 5 },
  { text: '7 Days', value: 7 },
  { text: '14 Days', value: 14 },
  { text: '30 Days', value: 30 }
]

// Backup state
const isLoadingBackups = ref(false)
const backupFilesList = computed(() => googleDocs.backupFiles.value)
const selectedBackupForRestore = ref<{ id: string; date: string } | null>(null)
const showAllBackups = ref(false)
const MAX_VISIBLE_BACKUPS = 3

// 限制顯示的備份數量
const displayedBackups = computed(() => {
  if (showAllBackups.value) {
    return backupFilesList.value
  }
  return backupFilesList.value.slice(0, MAX_VISIBLE_BACKUPS)
})

const hasMoreBackups = computed(() => backupFilesList.value.length > MAX_VISIBLE_BACKUPS)

// Watch for dialog open to sync local state
watch(isOpen, (open) => {
  if (open) {
    localSettings.value = { ...settingsStore.settings }
    clientIdInput.value = googleDocs.getClientId()
  }
})

// Watch for successful Google login to offer migration
watch(() => googleDocs.isConnected.value, (isConnected, wasConnected) => {
  // Only trigger when user just connected (not on page load with existing session)
  if (isConnected && !wasConnected) {
    // 延長等待時間，讓系統有足夠時間搜尋現有的同步檔案
    // 1. OAuth callback 後會搜尋現有檔案
    // 2. 如果找到檔案，hasSyncFile 會變成 true
    // 3. shouldOfferMigration 就會是 false
    setTimeout(() => {
      // 重新檢查是否需要 migration（因為搜尋可能已經完成）
      if (shouldOfferMigration.value) {
        showMigrationDialog.value = true
      }
    }, 2000)  // 給 2 秒時間讓搜尋完成
  }
})

// Initialize Google Docs on mount
onMounted(() => {
  googleDocs.initialize()
  // 檢查是否有 OAuth 回調
  googleDocs.handleOAuthCallback()
})

// Actions
function closeDialog() {
  settingsStore.closeSettingsDialog()
}

async function handleSignIn() {
  if (!clientIdInput.value) return
  
  isSigningIn.value = true
  googleDocs.setClientId(clientIdInput.value)
  
  try {
    // signIn() 會重定向到 Google，這個 Promise 不會 resolve
    await googleDocs.signIn()
  } finally {
    isSigningIn.value = false
  }
}

function handleSignOut() {
  googleDocs.signOut()
}

// 重新授權（token 過期時使用）
async function handleReauthorize() {
  isSigningIn.value = true
  
  try {
    await googleDocs.signIn()
  } finally {
    isSigningIn.value = false
  }
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

async function handleManualSync() {
  const data = tabsStore.getDataForExport()
  // 使用備份同步方法（不強制覆蓋）
  const result = await googleDocs.syncToGoogleDocsWithBackup(
    data,
    settingsStore.settings.backupEnabled,
    settingsStore.settings.backupRetentionDays,
    false
  )
  
  if (result === 'conflict') {
    showConflictDialog.value = true
  }
  
  // 同步後刷新備份列表
  if (result === 'success' && settingsStore.settings.backupEnabled) {
    await googleDocs.refreshBackupList()
  }
}

async function confirmForceSync() {
  showConflictDialog.value = false
  // 使用衝突解決方法（會先備份再覆蓋）
  const data = tabsStore.getDataForExport()
  const result = await googleDocs.resolveConflictWithLocal(
    data,
    settingsStore.settings.backupEnabled,
    settingsStore.settings.backupRetentionDays
  )
  
  if (result === 'success') {
    console.log('Successfully resolved conflict by overwriting cloud')
    // 刷新備份列表
    if (settingsStore.settings.backupEnabled) {
      await googleDocs.refreshBackupList()
    }
  }
}

// 衝突處理：選擇載入雲端資料
async function handleLoadFromCloudConflict() {
  showConflictDialog.value = false
  const data = await googleDocs.resolveConflictWithCloud()
  if (data && typeof data === 'object') {
    const loaded = tabsStore.loadFromData(data as any)
    if (loaded) {
      console.log('Successfully resolved conflict by loading from cloud')
    } else {
      console.error('Failed to load data from cloud during conflict resolution')
    }
  }
}

// 取消衝突處理（保持暫停狀態）
function cancelConflict() {
  showConflictDialog.value = false
  // 衝突狀態保留，自動同步仍然暫停
}

async function handleLoadFromCloud() {
  const data = await googleDocs.loadFromGoogleDocs()
  if (data && typeof data === 'object') {
    // Type assertion - the data structure should match StoredTabsData
    const loaded = tabsStore.loadFromData(data as any)
    if (loaded) {
      console.log('Successfully loaded data from cloud')
    } else {
      console.error('Failed to load data from cloud')
    }
  }
}

// 手動建立備份
async function handleManualBackup() {
  isCreatingBackup.value = true
  backupErrorMessage.value = ''
  
  try {
    const result = await googleDocs.createManualBackup()
    
    if (result === 'success') {
      showBackupSuccess.value = true
    } else if (result === 'conflict') {
      // 有衝突，顯示衝突對話框
      showConflictDialog.value = true
    } else if (result === 'no-data') {
      backupErrorMessage.value = 'No cloud data to backup. Please sync first.'
      showBackupError.value = true
    } else {
      backupErrorMessage.value = googleDocs.syncStatus.value.error || 'Unknown error'
      showBackupError.value = true
    }
  } catch (error) {
    backupErrorMessage.value = (error as Error).message
    showBackupError.value = true
  } finally {
    isCreatingBackup.value = false
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function resetSettings() {
  localSettings.value = {
    provider: 'local',
    autoSync: false,
    syncIntervalMinutes: 5,
    backupEnabled: false,
    backupRetentionDays: 7
  }
}

function saveAndClose() {
  // 儲存設定
  settingsStore.setProvider(localSettings.value.provider)
  settingsStore.setAutoSync(localSettings.value.autoSync)
  settingsStore.setSyncInterval(localSettings.value.syncIntervalMinutes)
  settingsStore.setBackupEnabled(localSettings.value.backupEnabled)
  settingsStore.setBackupRetentionDays(localSettings.value.backupRetentionDays)
  
  closeDialog()
}

// Backup functions
async function refreshBackups() {
  isLoadingBackups.value = true
  try {
    await googleDocs.refreshBackupList()
  } finally {
    isLoadingBackups.value = false
  }
}

async function handleRestoreBackup(backup: { id: string; date: string }) {
  selectedBackupForRestore.value = backup
  
  if (!confirm(`Are you sure you want to restore the backup from ${backup.date}? This will replace your current data.`)) {
    return
  }
  
  try {
    const data = await googleDocs.restoreFromBackup(backup.id)
    if (data && typeof data === 'object') {
      const loaded = tabsStore.loadFromData(data as any)
      if (loaded) {
        alert('Data restored successfully!')
        window.location.reload()
      } else {
        alert('Failed to restore data. Please try again.')
      }
    }
  } catch (error) {
    alert('Failed to restore backup: ' + (error as Error).message)
  }
}

// Migration functions
function skipMigration() {
  showMigrationDialog.value = false
}

async function performMigration() {
  isMigrating.value = true
  migrationErrorMessage.value = ''
  
  try {
    const data = tabsStore.getDataForExport()
    // 使用新的備份同步方法
    const result = await googleDocs.syncToGoogleDocsWithBackup(
      data,
      localSettings.value.backupEnabled,
      localSettings.value.backupRetentionDays
    )
    
    if (result === 'success') {
      showMigrationDialog.value = false
      showMigrationSuccess.value = true
      
      // Automatically switch to Google storage provider
      localSettings.value.provider = 'google'
      settingsStore.setProvider('google')
    } else {
      migrationErrorMessage.value = googleDocs.syncStatus.value.error || 'Unknown Error'
      showMigrationError.value = true
    }
  } catch (error) {
    migrationErrorMessage.value = (error as Error).message || 'Error occurred during migration'
    showMigrationError.value = true
  } finally {
    isMigrating.value = false
  }
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

.provider-toggle {
  border-radius: var(--radius-md);
  
  :deep(.v-btn) {
    text-transform: none;
    font-weight: 500;
    letter-spacing: 0;
  }
}

.google-settings {
  padding-top: 0.5rem;
}

.connection-status {
  .status-indicator {
    display: flex;
    align-items: center;
  }
}

.client-id-input {
  max-width: 220px;
  
  :deep(.v-field) {
    font-size: 0.8rem;
  }
}

.sync-interval-select {
  max-width: 140px;
}

.sync-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.last-sync-time {
  text-align: right;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: 0.5rem;
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
  
  .provider-toggle,
  .client-id-input,
  .sync-interval-select {
    width: 100%;
    max-width: none;
  }
  
  .sync-actions {
    width: 100%;
    
    .v-btn {
      flex: 1;
    }
  }
}

// Migration Dialog
.migration-dialog-card {
  border-radius: var(--radius-lg) !important;
  overflow: hidden;
}

.migration-content {
  p {
    color: var(--text-secondary);
  }
}

// Backup styles
.retention-days-select {
  max-width: 120px;
}

.backup-section {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color-light);
}

.backup-list {
  border: 1px solid var(--border-color);
  max-height: 180px;
  overflow-y: auto;
  
  .backup-item {
    border-bottom: 1px solid var(--border-color-light);
    
    &:last-child {
      border-bottom: none;
    }
  }
}

// Conflict dialog styles
.conflict-options {
  .conflict-option {
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
      border-color: var(--v-theme-primary);
      background: rgba(var(--v-theme-primary), 0.04);
    }
  }
}
</style>
