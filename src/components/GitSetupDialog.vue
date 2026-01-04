<template>
  <v-dialog
    v-model="isOpen"
    max-width="550"
    persistent
    transition="dialog-bottom-transition"
  >
    <v-card class="git-setup-dialog">
      <!-- Header -->
      <v-card-title class="dialog-header d-flex align-center justify-space-between">
        <div class="d-flex align-center gap-2">
          <v-icon color="primary">mdi-git</v-icon>
          <span class="text-h6 font-weight-bold">Git Sync Settings</span>
        </div>
        <v-btn icon variant="text" size="small" @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider />

      <v-card-text class="dialog-content">
        <!-- Credentials Section -->
        <div class="settings-section">
          <div class="section-header">
            <v-icon size="small" color="primary" class="mr-2">mdi-key</v-icon>
            <span class="section-title">Authentication</span>
          </div>

          <div class="section-content">
            <!-- GitHub Token -->
            <div class="setting-item">
              <div class="setting-label">
                <span class="setting-name">GitHub Personal Access Token</span>
                <span class="setting-hint">
                  <a 
                    href="https://github.com/settings/tokens/new?scopes=repo" 
                    target="_blank"
                    class="text-primary"
                  >
                    Create token
                    <v-icon size="12">mdi-open-in-new</v-icon>
                  </a>
                </span>
              </div>
              <v-text-field
                v-model="localCredentials.token"
                :type="showToken ? 'text' : 'password'"
                density="compact"
                variant="outlined"
                placeholder="ghp_xxxxxxxxxxxx"
                hide-details
                class="mt-2"
              >
                <template #append-inner>
                  <v-btn
                    icon
                    variant="text"
                    size="x-small"
                    @click="showToken = !showToken"
                  >
                    <v-icon size="18">{{ showToken ? 'mdi-eye-off' : 'mdi-eye' }}</v-icon>
                  </v-btn>
                </template>
              </v-text-field>
              <div class="security-note mt-1">
                <v-icon size="12" color="info">mdi-shield-check</v-icon>
                <span>Token is stored locally only, never synced to cloud</span>
              </div>
            </div>

            <!-- Author Name -->
            <div class="setting-item">
              <div class="setting-label">
                <span class="setting-name">Author Name</span>
              </div>
              <v-text-field
                v-model="localCredentials.userName"
                density="compact"
                variant="outlined"
                placeholder="Your Name"
                hide-details
                class="mt-2"
              />
            </div>

            <!-- Author Email -->
            <div class="setting-item">
              <div class="setting-label">
                <span class="setting-name">Author Email</span>
              </div>
              <v-text-field
                v-model="localCredentials.userEmail"
                density="compact"
                variant="outlined"
                placeholder="your.email@example.com"
                hide-details
                class="mt-2"
              />
            </div>
          </div>
        </div>

        <!-- Vault-Specific Settings (if vault selected) -->
        <div v-if="selectedVaultId" class="settings-section">
          <div class="section-header">
            <v-icon size="small" color="primary" class="mr-2">mdi-folder-cog</v-icon>
            <span class="section-title">{{ selectedVaultName }} Settings</span>
          </div>

          <div class="section-content">
            <!-- Repository Status -->
            <div class="setting-item">
              <div class="setting-label">
                <span class="setting-name">Repository Status</span>
              </div>
              <div class="status-chips mt-2">
                <v-chip
                  :color="vaultStatus?.isGitRepo ? 'success' : 'grey'"
                  size="small"
                  variant="tonal"
                >
                  <v-icon start size="14">
                    {{ vaultStatus?.isGitRepo ? 'mdi-check' : 'mdi-close' }}
                  </v-icon>
                  {{ vaultStatus?.isGitRepo ? 'Git initialized' : 'Not initialized' }}
                </v-chip>
                <v-chip
                  v-if="vaultStatus?.isGitRepo"
                  :color="vaultStatus?.hasRemote ? 'success' : 'warning'"
                  size="small"
                  variant="tonal"
                >
                  <v-icon start size="14">
                    {{ vaultStatus?.hasRemote ? 'mdi-check' : 'mdi-close' }}
                  </v-icon>
                  {{ vaultStatus?.hasRemote ? 'Remote configured' : 'No remote' }}
                </v-chip>
                <v-chip
                  v-if="vaultStatus?.hasObsidianGit"
                  color="info"
                  size="small"
                  variant="tonal"
                >
                  <v-icon start size="14">mdi-information</v-icon>
                  Obsidian Git detected
                </v-chip>
              </div>
            </div>

            <!-- Initialize Git Button -->
            <div v-if="!vaultStatus?.isGitRepo" class="setting-item">
              <v-btn
                color="primary"
                variant="flat"
                block
                :loading="isInitializing"
                @click="handleInitializeGit"
              >
                <v-icon start>mdi-git</v-icon>
                Initialize Git Repository
              </v-btn>
            </div>

            <!-- Remote URL -->
            <div v-if="vaultStatus?.isGitRepo" class="setting-item">
              <div class="setting-label">
                <span class="setting-name">Remote URL</span>
                <span v-if="suggestedUrl" class="setting-hint text-primary" style="cursor: pointer" @click="localRemoteUrl = suggestedUrl">
                  Use suggested: {{ suggestedRepoName }}
                </span>
              </div>
              <v-text-field
                v-model="localRemoteUrl"
                density="compact"
                variant="outlined"
                :placeholder="suggestedUrl || 'https://github.com/user/vault.git'"
                hide-details
                class="mt-2"
                @blur="checkRemoteExists"
              />
              
              <!-- Repo Status Messages -->
              <div v-if="isCheckingRepo" class="repo-status mt-2">
                <v-progress-circular size="16" width="2" indeterminate class="mr-2" />
                <span>Checking repository...</span>
              </div>
              
              <v-alert
                v-else-if="repoCheckResult === 'not-found' && localRemoteUrl"
                type="warning"
                variant="tonal"
                density="compact"
                class="mt-2"
              >
                <div class="d-flex flex-column gap-2">
                  <span>Repository does not exist on GitHub</span>
                  <div class="d-flex gap-2">
                    <v-btn
                      size="small"
                      color="primary"
                      variant="flat"
                      :loading="isCreatingRepo"
                      @click="handleCreateRepo(true)"
                    >
                      <v-icon start size="16">mdi-lock</v-icon>
                      Create Private
                    </v-btn>
                    <v-btn
                      size="small"
                      color="secondary"
                      variant="tonal"
                      :loading="isCreatingRepo"
                      @click="handleCreateRepo(false)"
                    >
                      <v-icon start size="16">mdi-earth</v-icon>
                      Create Public
                    </v-btn>
                  </div>
                </div>
              </v-alert>
              
              <v-alert
                v-else-if="repoCheckResult === 'exists' && localRemoteUrl"
                type="success"
                variant="tonal"
                density="compact"
                class="mt-2"
              >
                <v-icon start size="16">mdi-check</v-icon>
                Repository exists
              </v-alert>
              
              <v-alert
                v-else-if="repoCheckResult === 'error'"
                type="error"
                variant="tonal"
                density="compact"
                class="mt-2"
              >
                {{ repoCheckError }}
              </v-alert>

              <v-btn
                v-if="localRemoteUrl !== currentRemoteUrl && repoCheckResult === 'exists'"
                color="primary"
                variant="tonal"
                size="small"
                class="mt-2"
                :loading="isSettingRemote"
                @click="handleSetRemote"
              >
                {{ currentRemoteUrl ? 'Update Remote' : 'Set Remote' }}
              </v-btn>
            </div>

            <!-- Sync Settings -->
            <div v-if="vaultStatus?.isGitRepo && vaultStatus?.hasRemote" class="setting-item">
              <div class="setting-label">
                <span class="setting-name">Commit Message Style</span>
              </div>
              <v-select
                v-model="localSyncSettings.commitMessageStyle"
                :items="commitMessageStyles"
                item-title="label"
                item-value="value"
                density="compact"
                variant="outlined"
                hide-details
                class="mt-2"
              />
            </div>

            <!-- Obsidian Git Mode -->
            <div v-if="vaultStatus?.hasObsidianGit" class="setting-item">
              <div class="setting-label">
                <span class="setting-name">Obsidian Git Coexistence</span>
                <span class="setting-hint">How to handle existing Obsidian Git plugin</span>
              </div>
              <v-select
                v-model="localSyncSettings.obsidianGitMode"
                :items="obsidianGitModes"
                item-title="label"
                item-value="value"
                density="compact"
                variant="outlined"
                hide-details
                class="mt-2"
              />
            </div>
            
            <!-- Manual Sync -->
            <div v-if="vaultStatus?.isGitRepo" class="setting-item mt-4">
              <div class="setting-label">
                <span class="setting-name">Manual Sync</span>
                <span v-if="lastSyncTime" class="setting-hint">
                  Last synced: {{ formatLastSyncTime(lastSyncTime) }}
                </span>
              </div>
              <div class="d-flex gap-2 mt-2">
                <v-btn
                  color="primary"
                  variant="flat"
                  :loading="isSyncing"
                  :disabled="!localCredentials.token || !vaultStatus?.hasRemote"
                  @click="handleManualSync"
                >
                  <v-icon start>mdi-sync</v-icon>
                  Sync Now
                </v-btn>
                <v-btn
                  color="secondary"
                  variant="tonal"
                  :loading="isPulling"
                  :disabled="!localCredentials.token || !vaultStatus?.hasRemote"
                  @click="handlePullOnly"
                >
                  <v-icon start>mdi-cloud-download</v-icon>
                  Pull Only
                </v-btn>
              </div>
              
              <!-- No Remote Warning -->
              <v-alert
                v-if="!vaultStatus?.hasRemote"
                type="info"
                variant="tonal"
                density="compact"
                class="mt-2"
              >
                Please configure Remote URL above to enable sync.
              </v-alert>
              
              <!-- Sync Status Messages -->
              <v-alert
                v-if="syncResult && !syncResult.success"
                type="error"
                variant="tonal"
                density="compact"
                class="mt-2"
                closable
                @click:close="syncResult = null"
              >
                {{ syncResult.error }}
              </v-alert>
              
              <v-alert
                v-if="syncResult && syncResult.success"
                type="success"
                variant="tonal"
                density="compact"
                class="mt-2"
                closable
                @click:close="syncResult = null"
              >
                Sync completed successfully!
                <span v-if="syncResult.pulledFiles">Pulled {{ syncResult.pulledFiles }} files.</span>
                <span v-if="syncResult.pushedFiles">Pushed {{ syncResult.pushedFiles }} commits.</span>
              </v-alert>
            </div>
            
            <!-- Danger Zone -->
            <div v-if="selectedVaultId" class="setting-item mt-4">
              <div class="setting-label">
                <span class="setting-name text-error">Danger Zone</span>
              </div>
              <v-btn
                color="error"
                variant="outlined"
                block
                class="mt-2"
                :loading="isResetting"
                @click="showResetConfirm = true"
              >
                <v-icon start>mdi-alert</v-icon>
                Reset Git Repository
              </v-btn>
              <div class="get-help-text mt-1 text-caption text-error">
                Removes .git folder and clears this vault's Git config. Files are kept.
              </div>
            </div>
          </div>
        </div>

        <!-- Auto Sync Section -->
        <div class="settings-section">
          <div class="section-header">
            <v-icon size="small" color="primary" class="mr-2">mdi-sync</v-icon>
            <span class="section-title">Auto Sync (Advanced)</span>
          </div>

          <div class="section-content">
            <div class="setting-item">
              <v-switch
                v-model="localSyncSettings.autoSyncEnabled"
                label="Enable auto sync"
                color="primary"
                density="compact"
                hide-details
              />
            </div>

            <v-expand-transition>
              <div v-if="localSyncSettings.autoSyncEnabled">
                <div class="setting-item">
                  <v-switch
                    v-model="localSyncSettings.autoPullOnStartup"
                    label="Auto pull on startup"
                    color="primary"
                    density="compact"
                    hide-details
                  />
                </div>

                <div class="setting-item">
                  <div class="setting-label">
                    <span class="setting-name">Sync interval (minutes)</span>
                  </div>
                  <v-slider
                    v-model="localSyncSettings.autoSyncInterval"
                    :min="1"
                    :max="60"
                    :step="1"
                    thumb-label
                    density="compact"
                    hide-details
                    class="mt-2"
                  />
                </div>
              </div>
            </v-expand-transition>
          </div>
        </div>
      </v-card-text>

      <v-divider />

      <!-- Actions -->
      <v-card-actions class="dialog-actions">
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-spacer />
        <v-btn
          v-if="hasCredentialsInput"
          color="error"
          variant="text"
          @click="handleClearCredentials"
        >
          Clear Credentials
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :disabled="!isValid"
          @click="handleSave"
        >
          Save Settings
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Reset Confirmation Dialog -->
    <v-dialog v-model="showResetConfirm" max-width="400">
      <v-card>
        <v-card-title class="text-error">
          <v-icon start color="error">mdi-alert-circle</v-icon>
          Reset Git Repository?
        </v-card-title>
        <v-card-text>
          This will permanently delete the <code>.git</code> folder and clear the Git configuration for this vault. Your files will NOT be deleted.
          <br><br>
          This action cannot be undone. Are you sure?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showResetConfirm = false">Cancel</v-btn>
          <v-btn color="error" variant="flat" :loading="isResetting" @click="handleConfirmReset">
            Yes, Reset
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useGitSync } from '../composables/useGitSync'
import { useFileSystemStore } from '../stores/fileSystemStore'
import { useGitStore } from '../stores/gitStore'
import type { GitCredentials, GitSyncSettings, SyncResult, VaultGitStatus } from '../types/git'
import { DEFAULT_SYNC_SETTINGS } from '../types/git'

// Props
const props = defineProps<{
  modelValue: boolean
  vaultId?: string | null
}>()

// Emits
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved'): void
}>()

// Stores
const gitStore = useGitStore()
const fileSystemStore = useFileSystemStore()
const gitSync = useGitSync()

const { credentials, vaultConfigs } = storeToRefs(gitStore)
const { vaults } = storeToRefs(fileSystemStore)

// State
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const showToken = ref(false)
const isInitializing = ref(false)
const isSettingRemote = ref(false)
const isCheckingRepo = ref(false)
const isCreatingRepo = ref(false)
const isResetting = ref(false)
const showResetConfirm = ref(false)
const repoCheckResult = ref<'exists' | 'not-found' | 'error' | null>(null)
const repoCheckError = ref<string | null>(null)
const githubUsername = ref<string | null>(null)

// Sync state
const isSyncing = ref(false)
const isPulling = ref(false)
const syncResult = ref<SyncResult | null>(null)

const localCredentials = ref<GitCredentials>({
  token: '',
  userName: '',
  userEmail: '',
})

const localSyncSettings = ref<GitSyncSettings>({ ...DEFAULT_SYNC_SETTINGS })
const localRemoteUrl = ref('')

// Options
const commitMessageStyles = [
  { value: 'ai', label: '🤖 AI-powered (requires Gemini API key)' },
  { value: 'smart', label: '🧠 Smart (auto-generate based on changes)' },
  { value: 'timestamp', label: '⏰ Timestamp (vault backup: 2026-01-04)' },
  { value: 'custom', label: '✏️ Custom template' },
]

const obsidianGitModes = [
  { value: 'auto', label: 'Auto (enter pull-only mode if Obsidian Git detected)' },
  { value: 'full', label: 'Full (use md-viewer Git, ignore Obsidian Git)' },
  { value: 'pull-only', label: 'Pull-only (let Obsidian Git handle commits)' },
]

// Computed
const selectedVaultId = computed(() => props.vaultId)

const selectedVaultName = computed(() => {
  if (!selectedVaultId.value) return ''
  const vault = vaults.value.find(v => v.id === selectedVaultId.value)
  return vault?.name || ''
})

const selectedVaultHandle = computed(() => {
  if (!selectedVaultId.value) return null
  const vault = vaults.value.find(v => v.id === selectedVaultId.value)
  return vault?.handle || null
})

const vaultConfig = computed(() => {
  if (!selectedVaultId.value) return null
  return vaultConfigs.value[selectedVaultId.value] || null
})

const vaultStatus = computed((): VaultGitStatus | null => {
  return vaultConfig.value?.status || null
})

const currentRemoteUrl = computed(() => {
  return vaultConfig.value?.remote?.url || ''
})

const hasCredentialsInput = computed(() => {
  return !!localCredentials.value.token
})


const isValid = computed(() => {
  // At minimum, need token if credentials are being set
  if (localCredentials.value.token && !localCredentials.value.userName) {
    return false
  }
  return true
})

// Suggested repo name and URL
const suggestedRepoName = computed(() => {
  if (!selectedVaultName.value) return ''
  return gitSync.suggestRepoName(selectedVaultName.value)
})

const suggestedUrl = computed(() => {
  if (!githubUsername.value || !suggestedRepoName.value) return ''
  return `https://github.com/${githubUsername.value}/${suggestedRepoName.value}.git`
})

const lastSyncTime = computed(() => {
  return vaultConfig.value?.status?.lastSyncTime || null
})

// Watchers
watch(isOpen, async (open) => {
  if (open) {
    // Reset repo check state
    repoCheckResult.value = null
    repoCheckError.value = null
    
    // Load current values
    if (credentials.value) {
      localCredentials.value = { ...credentials.value }
    } else {
      localCredentials.value = { token: '', userName: '', userEmail: '' }
    }

    if (vaultConfig.value) {
      localSyncSettings.value = { ...vaultConfig.value.syncSettings }
      localRemoteUrl.value = vaultConfig.value.remote?.url || ''
    } else {
      localSyncSettings.value = { ...DEFAULT_SYNC_SETTINGS }
      localRemoteUrl.value = ''
    }

    // Refresh vault status
    if (selectedVaultId.value && selectedVaultHandle.value) {
      refreshVaultStatus()
    }
    
    // Fetch GitHub username for suggested URL
    if (localCredentials.value.token) {
      await fetchGitHubUsername()
    }
  }
})

watch(selectedVaultId, async (newId) => {
  if (newId && isOpen.value) {
    if (vaultConfigs.value[newId]) {
      localSyncSettings.value = { ...vaultConfigs.value[newId].syncSettings }
      localRemoteUrl.value = vaultConfigs.value[newId].remote?.url || ''
    } else {
      localSyncSettings.value = { ...DEFAULT_SYNC_SETTINGS }
      localRemoteUrl.value = ''
    }
    await refreshVaultStatus()
  }
})

// Methods
function close() {
  isOpen.value = false
}

async function refreshVaultStatus() {
  if (!selectedVaultId.value || !selectedVaultHandle.value) return
  
  const status = await gitSync.getStatus(selectedVaultId.value, selectedVaultHandle.value)
  gitStore.getVaultConfig(selectedVaultId.value, selectedVaultName.value)
  gitStore.updateVaultStatus(selectedVaultId.value, status)
}

async function handleInitializeGit() {
  if (!selectedVaultId.value || !selectedVaultHandle.value) return
  
  isInitializing.value = true
  try {
    await gitSync.initializeGit(selectedVaultId.value, selectedVaultHandle.value)
    await refreshVaultStatus()
  } catch (error) {
    console.error('Failed to initialize Git:', error)
  } finally {
    isInitializing.value = false
  }
}

async function handleSetRemote() {
  if (!selectedVaultId.value || !selectedVaultHandle.value || !localRemoteUrl.value) return
  
  isSettingRemote.value = true
  try {
    await gitSync.setRemote(selectedVaultId.value, selectedVaultHandle.value, localRemoteUrl.value)
    await refreshVaultStatus()
  } catch (error) {
    console.error('Failed to set remote:', error)
  } finally {
    isSettingRemote.value = false
  }
}

async function checkRemoteExists() {
  if (!localRemoteUrl.value || !localCredentials.value.token) {
    repoCheckResult.value = null
    return
  }
  
  isCheckingRepo.value = true
  repoCheckResult.value = null
  repoCheckError.value = null
  
  try {
    // Temporarily set credentials if not saved yet
    if (!gitStore.hasCredentials) {
      gitStore.setCredentials(localCredentials.value)
    }
    
    const exists = await gitSync.checkRepoExists(localRemoteUrl.value)
    repoCheckResult.value = exists ? 'exists' : 'not-found'
  } catch (error) {
    repoCheckResult.value = 'error'
    repoCheckError.value = error instanceof Error ? error.message : 'Failed to check repository'
  } finally {
    isCheckingRepo.value = false
  }
}

async function handleCreateRepo(isPrivate: boolean) {
  if (!selectedVaultId.value || !selectedVaultHandle.value || !localRemoteUrl.value) return
  
  isCreatingRepo.value = true
  
  try {
    // Ensure credentials are saved
    if (!gitStore.hasCredentials) {
      gitStore.setCredentials(localCredentials.value)
    }
    
    const result = await gitSync.smartSetupRemote(
      selectedVaultId.value,
      selectedVaultHandle.value,
      localRemoteUrl.value,
      true, // createIfNotExists
      isPrivate
    )
    
    if (result.success) {
      repoCheckResult.value = 'exists'
      await refreshVaultStatus()
    } else {
      repoCheckResult.value = 'error'
      repoCheckError.value = result.error || 'Failed to create repository'
    }
  } catch (error) {
    repoCheckResult.value = 'error'
    repoCheckError.value = error instanceof Error ? error.message : 'Failed to create repository'
  } finally {
    isCreatingRepo.value = false
  }
}

async function handleConfirmReset() {
  if (!selectedVaultId.value || !selectedVaultHandle.value) return
  
  isResetting.value = true
  
  try {
    await gitSync.resetGit(selectedVaultId.value, selectedVaultHandle.value)
    showResetConfirm.value = false
    
    // Reset local state
    localRemoteUrl.value = ''
    localSyncSettings.value = { ...DEFAULT_SYNC_SETTINGS }
    
    await refreshVaultStatus()
  } catch (error) {
    console.error('Failed to reset Git:', error)
  } finally {
    isResetting.value = false
  }
}

async function fetchGitHubUsername() {
  if (localCredentials.value.token) {
    // Temporarily set credentials
    gitStore.setCredentials(localCredentials.value)
    githubUsername.value = await gitSync.getGitHubUsername()
  }
}

// Format time for display
function formatLastSyncTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Manual sync handler
async function handleManualSync() {
  if (!selectedVaultId.value || !selectedVaultHandle.value) return
  
  // Always save credentials before sync to ensure they are up-to-date
  if (localCredentials.value.token) {
    gitStore.setCredentials(localCredentials.value)
  }
  
  isSyncing.value = true
  syncResult.value = null
  
  try {
    // Get changed files for commit message
    const changes = await gitSync.getChangedFiles(selectedVaultId.value, selectedVaultHandle.value)
    
    const commitMessage = gitSync.generateCommitMessage(
      changes,
      localSyncSettings.value.commitMessageStyle,
      localSyncSettings.value.commitMessageTemplate,
      selectedVaultName.value
    )
    
    const result = await gitSync.syncAll(
      selectedVaultId.value,
      selectedVaultHandle.value,
      commitMessage
    )
    
    syncResult.value = result
    
    if (result.success) {
      await refreshVaultStatus()
    }
  } catch (error) {
    console.error('[GitSync] Manual sync failed:', error)
    syncResult.value = {
      success: false,
      pulledFiles: 0,
      pushedFiles: 0,
      hasConflicts: false,
      conflictFiles: [],
      error: error instanceof Error ? error.message : 'Sync failed',
    }
  } finally {
    isSyncing.value = false
  }
}

// Pull only handler
async function handlePullOnly() {
  if (!selectedVaultId.value || !selectedVaultHandle.value) return
  
  // Always save credentials before sync to ensure they are up-to-date
  if (localCredentials.value.token) {
    gitStore.setCredentials(localCredentials.value)
  }
  
  isPulling.value = true
  syncResult.value = null
  
  try {
    const pullResult = await gitSync.pull(selectedVaultId.value, selectedVaultHandle.value)
    
    syncResult.value = {
      success: pullResult.success,
      pulledFiles: pullResult.updatedFiles,
      pushedFiles: 0,
      hasConflicts: pullResult.hasConflicts,
      conflictFiles: pullResult.conflictFiles,
      error: pullResult.error,
    }
    
    if (pullResult.success) {
      await refreshVaultStatus()
    }
  } catch (error) {
    console.error('Pull failed:', error)
    syncResult.value = {
      success: false,
      pulledFiles: 0,
      pushedFiles: 0,
      hasConflicts: false,
      conflictFiles: [],
      error: error instanceof Error ? error.message : 'Pull failed',
    }
  } finally {
    isPulling.value = false
  }
}

function handleClearCredentials() {
  gitStore.clearCredentials()
  localCredentials.value = { token: '', userName: '', userEmail: '' }
}

function handleSave() {
  // Save credentials
  if (localCredentials.value.token) {
    gitStore.setCredentials(localCredentials.value)
  }

  // Save vault settings
  if (selectedVaultId.value) {
    gitStore.getVaultConfig(selectedVaultId.value, selectedVaultName.value)
    gitStore.updateVaultSettings(selectedVaultId.value, localSyncSettings.value)
  }

  emit('saved')
  close()
}
</script>

<style scoped>
.git-setup-dialog {
  border-radius: 12px !important;
}

.dialog-header {
  padding: 16px 20px;
}

.dialog-content {
  padding: 0 !important;
  max-height: 70vh;
  overflow-y: auto;
}

.settings-section {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
}

.settings-section:last-child {
  border-bottom: none;
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.87);
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  display: flex;
  flex-direction: column;
}

.setting-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.setting-name {
  font-size: 13px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.87);
}

.setting-hint {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.security-note {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.status-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dialog-actions {
  padding: 12px 20px;
}

.repo-status {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
</style>
