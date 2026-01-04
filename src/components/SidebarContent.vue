<template>
  <div class="sidebar-content">
    <!-- Local Mode: Multi-Vault Display -->
    <div class="local-mode-content">
        <!-- Vault List Header -->
        <div class="vaults-header">
          <span class="header-title">VAULTS</span>
          <v-btn
            icon
            variant="text"
            size="x-small"
            title="Add Vault"
            :loading="isLoading"
            @click="handleAddVault"
          >
            <v-icon size="16">mdi-plus</v-icon>
          </v-btn>
        </div>

        <!-- Connected Vaults List -->
        <div class="vaults-list" v-if="vaults.length > 0">
          <div
            v-for="vault in vaults"
            :key="vault.id"
            class="vault-item"
          >
            <!-- Vault Header (Expandable) -->
            <div 
              class="vault-header"
              @click="handleToggleVault(vault.id)"
            >
              <v-icon size="16" class="expand-icon">
                {{ vault.expanded ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
              </v-icon>
              <v-icon size="18" class="vault-icon" color="primary">
                mdi-folder-key-outline
              </v-icon>
              <span class="vault-name" :title="vault.name">{{ vault.name }}</span>
              <div class="vault-actions">
                <v-btn
                  icon
                  variant="text"
                  size="x-small"
                  title="Refresh"
                  @click.stop="handleRefreshVault(vault.id)"
                >
                  <v-icon size="14">mdi-refresh</v-icon>
                </v-btn>
                <v-btn
                  icon
                  variant="text"
                  size="x-small"
                  title="New File"
                  @click.stop="handleNewFile(vault.id)"
                >
                  <v-icon size="14">mdi-file-plus-outline</v-icon>
                </v-btn>
                <v-btn
                  icon
                  variant="text"
                  size="x-small"
                  title="New Folder"
                  @click.stop="handleNewFolderRoot(vault.id)"
                >
                  <v-icon size="14">mdi-folder-plus-outline</v-icon>
                </v-btn>
                <v-btn
                  icon
                  variant="text"
                  size="x-small"
                  title="Remove Vault"
                  @click.stop="handleRemoveVault(vault.id)"
                >
                  <v-icon size="14">mdi-close</v-icon>
                </v-btn>
              </div>
            </div>

            <!-- Vault Contents (Expanded) -->
            <div v-show="vault.expanded" class="vault-contents">
              <LocalFileItem
                v-for="entry in vault.entries"
                :key="entry.path"
                :entry="entry"
                :vault-id="vault.id"
                :depth="0"
                @open-file="handleOpenFile"
                @toggle-directory="handleToggleDirectory"
                @create-file="handleCreateFileInDir"
                @create-folder="handleCreateFolder"
                @rename="handleRename"
                @delete="handleDelete"
                @move="handleMove"
              />
              <div v-if="vault.entries.length === 0" class="empty-vault">
                <span>No markdown files found</span>
              </div>
            </div>
          </div>
        </div>

        <!-- No Vaults - Show Add Prompt -->
        <div v-else class="vault-prompt">
          <div class="prompt-icon">
            <v-icon size="48" color="primary">mdi-folder-key-outline</v-icon>
          </div>
          <h3 class="prompt-title">Add Obsidian Vault</h3>
          <p class="prompt-description">
            Connect to local folders to edit your Obsidian notes directly.
            You can add multiple vaults.
          </p>
          <v-btn
            color="primary"
            variant="elevated"
            size="large"
            :loading="isLoading"
            @click="handleAddVault"
          >
            <v-icon start>mdi-folder-plus-outline</v-icon>
            Add Vault
          </v-btn>

          <!-- Saved vaults that need permission -->
          <div v-if="savedVaultNames.length > 0" class="reconnect-prompt">
            <p>Previously used vaults (need permission):</p>
            <div class="saved-vaults">
              <v-chip
                v-for="saved in savedVaultNames"
                :key="saved.id"
                size="small"
                @click="handleReconnectVault(saved.id)"
              >
                <v-icon start size="14">mdi-folder-key-outline</v-icon>
                {{ saved.name }}
              </v-chip>
            </div>
          </div>

          <!-- Not supported warning -->
          <div v-if="!isSupported" class="not-supported-warning">
            <v-icon color="warning" size="18">mdi-alert-outline</v-icon>
            <span>File System Access is not supported in this browser. 
              Please use Chrome, Edge, or Opera.</span>
          </div>
        </div>
      </div>

    <!-- Git Sync Panel -->
    <GitSyncPanel
      @open-settings="openGitSettings(null)"
      @setup-vault="openGitSettings"
      @sync-complete="handleSyncComplete"
    />

    <!-- Git Setup Dialog -->
    <GitSetupDialog
      v-model="showGitSettings"
      :vault-id="selectedVaultForGit"
      @saved="handleGitSettingsSaved"
    />

    <!-- Error Snackbar -->
    <v-snackbar
      v-model="showError"
      :timeout="5000"
      color="error"
      location="bottom"
    >
      {{ errorMessage }}
      <template v-slot:actions>
        <v-btn variant="text" @click="clearError">
          Close
        </v-btn>
      </template>
    </v-snackbar>

    <!-- Success Snackbar -->
    <v-snackbar
      v-model="showSuccess"
      :timeout="3000"
      color="success"
      location="bottom"
    >
      {{ successMessage }}
    </v-snackbar>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteConfirm" max-width="400">
      <v-card>
        <v-card-title class="text-h6">
          <v-icon color="error" class="mr-2">mdi-alert-circle-outline</v-icon>
          Confirm Delete
        </v-card-title>
        <v-card-text>
          Are you sure you want to delete 
          <strong>{{ deleteTarget?.path.split('/').pop() }}</strong>?
          <br>
          <span v-if="deleteTarget?.kind === 'directory'" class="text-error">
            This will delete all files and folders inside.
          </span>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="cancelDelete">Cancel</v-btn>
          <v-btn color="error" variant="elevated" @click="confirmDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Input Dialog (for new file/folder) -->
    <v-dialog v-model="showInputDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h6">{{ inputDialogTitle }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="inputDialogValue"
            label="Name"
            variant="outlined"
            density="compact"
            autofocus
            @keydown.enter="confirmInput"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeInputDialog">Cancel</v-btn>
          <v-btn color="primary" variant="elevated" @click="confirmInput">Create</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, ref, watch } from 'vue'
import { useFileSystem } from '../composables/useFileSystem'
import { useGitSync } from '../composables/useGitSync'
import { useFileSystemStore } from '../stores/fileSystemStore'
import { useGitStore } from '../stores/gitStore'
import type { LocalFile } from '../types/fileSystem'
import GitSetupDialog from './GitSetupDialog.vue'
import GitSyncPanel from './GitSyncPanel.vue'
import LocalFileItem from './LocalFileItem.vue'

const fileSystemStore = useFileSystemStore()
const gitStore = useGitStore()
const gitSync = useGitSync()
const { isLoading, error, isSupported, vaults } = storeToRefs(fileSystemStore)
const {
  addVault,
  removeVault,
  reconnectVaults,
  toggleVaultExpanded,
  toggleDirectoryExpanded,
  refreshVault,
  openFile,
  createNewFile,
  clearError: clearStoreError
} = useFileSystem()

// UI State
const showError = ref(false)
const errorMessage = ref('')
const savedVaultNames = ref<Array<{ id: string; name: string }>>([])

// Git UI State
const showGitSettings = ref(false)
const selectedVaultForGit = ref<string | null>(null)
const showSuccess = ref(false)
const successMessage = ref('')

// File management dialog state
const showDeleteConfirm = ref(false)
const deleteTarget = ref<{ vaultId: string; path: string; kind: 'file' | 'directory' } | null>(null)
const showInputDialog = ref(false)
const inputDialogTitle = ref('')
const inputDialogValue = ref('')
const inputDialogCallback = ref<((value: string) => void) | null>(null)

// Watch for errors
watch(error, (newError) => {
  if (newError) {
    errorMessage.value = newError
    showError.value = true
  }
})


// Check for saved vaults and try to reconnect on mount
onMounted(async () => {
  // Initialize Git store
  gitStore.initialize()
  
  // Try to reconnect to saved vaults
  await reconnectVaults()
  
  // Refresh Git status for each connected vault
  // This ensures we show actual status instead of "Not initialized"
  for (const vault of vaults.value) {
    if (vault.handle) {
      try {
        const status = await gitSync.getStatus(vault.id, vault.handle)
        gitStore.updateVaultStatus(vault.id, status)
      } catch (error) {
        console.warn(`Failed to refresh Git status for vault ${vault.name}:`, error)
      }
    }
  }
  
  // Get list of saved vaults for reconnection UI
  savedVaultNames.value = await fileSystemStore.getSavedVaultNames()
  
  // Remove already connected vaults from the saved list
  const connectedIds = new Set(vaults.value.map(v => v.id))
  savedVaultNames.value = savedVaultNames.value.filter(v => !connectedIds.has(v.id))
})

async function handleAddVault() {
  const vault = await addVault()
  if (vault) {
    // Remove from saved list if it was there
    savedVaultNames.value = savedVaultNames.value.filter(v => v.id !== vault.id)
  }
}

async function handleRemoveVault(vaultId: string) {
  await removeVault(vaultId)
}

async function handleReconnectVault(vaultId: string) {
  const success = await fileSystemStore.requestVaultPermission(vaultId)
  if (success) {
    // Remove from saved list
    savedVaultNames.value = savedVaultNames.value.filter(v => v.id !== vaultId)
  }
}

function handleToggleVault(vaultId: string) {
  toggleVaultExpanded(vaultId)
}

function handleToggleDirectory(vaultId: string, dirPath: string) {
  toggleDirectoryExpanded(vaultId, dirPath)
}

async function handleRefreshVault(vaultId: string) {
  await refreshVault(vaultId)
}

async function handleNewFile(vaultId: string) {
  await createNewFile(vaultId)
}

async function handleNewFolderRoot(vaultId: string) {
  handleCreateFolder(vaultId, '')
}

async function handleOpenFile(file: LocalFile, vaultId: string) {
  await openFile(file, vaultId)
}

// File management handlers
async function handleCreateFileInDir(vaultId: string, parentPath: string) {
  showInputPrompt('New File', 'Untitled', async (name) => {
    if (name) {
      await fileSystemStore.createFileInDirectory(vaultId, parentPath, name)
    }
  })
}

async function handleCreateFolder(vaultId: string, parentPath: string) {
  showInputPrompt('New Folder', 'New Folder', async (name) => {
    if (name) {
      await fileSystemStore.createDirectoryInVault(vaultId, parentPath, name)
    }
  })
}

async function handleRename(vaultId: string, path: string, kind: 'file' | 'directory', newName: string) {
  if (!newName) return
  
  if (kind === 'file') {
    await fileSystemStore.renameFileInVault(vaultId, path, newName)
  } else {
    await fileSystemStore.renameDirectoryInVault(vaultId, path, newName)
  }
}

function handleDelete(vaultId: string, path: string, kind: 'file' | 'directory') {
  deleteTarget.value = { vaultId, path, kind }
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  
  const { vaultId, path, kind } = deleteTarget.value
  
  if (kind === 'file') {
    await fileSystemStore.deleteFileInVault(vaultId, path)
  } else {
    await fileSystemStore.deleteDirectoryInVault(vaultId, path)
  }
  
  showDeleteConfirm.value = false
  deleteTarget.value = null
  successMessage.value = `${kind === 'file' ? 'File' : 'Folder'} deleted successfully`
  showSuccess.value = true
}

function cancelDelete() {
  showDeleteConfirm.value = false
  deleteTarget.value = null
}

async function handleMove(vaultId: string, sourcePath: string, targetPath: string, kind: 'file' | 'directory') {
  if (kind === 'file') {
    await fileSystemStore.moveFileInVault(vaultId, sourcePath, targetPath)
  } else {
    await fileSystemStore.moveDirectoryInVault(vaultId, sourcePath, targetPath)
  }
  successMessage.value = `${kind === 'file' ? 'File' : 'Folder'} moved successfully`
  showSuccess.value = true
}

// Input dialog helpers
function showInputPrompt(title: string, defaultValue: string, callback: (value: string) => void) {
  inputDialogTitle.value = title
  inputDialogValue.value = defaultValue
  inputDialogCallback.value = callback
  showInputDialog.value = true
}

function confirmInput() {
  if (inputDialogCallback.value && inputDialogValue.value.trim()) {
    inputDialogCallback.value(inputDialogValue.value.trim())
  }
  closeInputDialog()
}

function closeInputDialog() {
  showInputDialog.value = false
  inputDialogValue.value = ''
  inputDialogCallback.value = null
}

function clearError() {
  showError.value = false
  clearStoreError()
}

// Git-related functions
function openGitSettings(vaultId: string | null) {
  selectedVaultForGit.value = vaultId
  showGitSettings.value = true
}

function handleGitSettingsSaved() {
  successMessage.value = 'Git settings saved successfully'
  showSuccess.value = true
}

function handleSyncComplete(vaultId: string, success: boolean) {
  if (success) {
    successMessage.value = 'Sync completed successfully'
    showSuccess.value = true
  } else {
    const vaultConfig = gitStore.vaultConfigs[vaultId]
    errorMessage.value = vaultConfig?.status.errorMessage || 'Sync failed'
    showError.value = true
  }
}
</script>

<style scoped lang="scss">
.sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-sidebar);
}

.local-mode-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.vaults-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  
  .header-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-tertiary);
    letter-spacing: 0.5px;
  }
}

.vaults-list {
  flex: 1;
  overflow-y: auto;
}

.vault-item {
  border-bottom: 1px solid var(--border-color);
}

.vault-header {
  display: flex;
  align-items: center;
  padding: 8px 8px 8px 4px;
  cursor: pointer;
  gap: 4px;
  
  &:hover {
    background-color: var(--hover-bg);
  }
  
  .expand-icon {
    opacity: 0.6;
  }
  
  .vault-icon {
    margin-right: 4px;
  }
  
  .vault-name {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .vault-actions {
    display: flex;
    opacity: 0;
    transition: opacity 0.15s;
  }
  
  &:hover .vault-actions {
    opacity: 1;
  }
}

.vault-contents {
  padding-left: 8px;
}

.empty-vault {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
}

.vault-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  text-align: center;
  flex: 1;
}

.prompt-icon {
  margin-bottom: 16px;
  padding: 20px;
  border-radius: 50%;
  background: linear-gradient(
    135deg,
    rgba(99, 102, 241, 0.12) 0%,
    rgba(139, 92, 246, 0.12) 100%
  );
}

.prompt-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.prompt-description {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 24px;
  line-height: 1.5;
  max-width: 280px;
}

.reconnect-prompt {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
  text-align: center;
  
  p {
    font-size: 12px;
    color: var(--text-tertiary);
    margin-bottom: 12px;
  }
  
  .saved-vaults {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }
}

.not-supported-warning {
  margin-top: 24px;
  padding: 12px 16px;
  background: rgba(251, 191, 36, 0.1);
  border-radius: 8px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 12px;
  color: var(--text-secondary);
  max-width: 280px;
  text-align: left;
  
  .v-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }
}
</style>
