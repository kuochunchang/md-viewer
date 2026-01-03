<template>
  <div class="sidebar-content">
    <!-- Mode Switcher -->
    <div class="mode-switcher" v-if="isSupported">
      <v-btn-toggle
        v-model="currentMode"
        mandatory
        density="compact"
        class="mode-toggle"
      >
        <v-btn value="browser" size="small" class="mode-btn">
          <v-icon size="16" start>mdi-cloud-outline</v-icon>
          Browser
        </v-btn>
        <v-btn value="local" size="small" class="mode-btn">
          <v-icon size="16" start>mdi-folder-outline</v-icon>
          Local
        </v-btn>
      </v-btn-toggle>
    </div>

    <!-- Browser Mode: Original FileList -->
    <FileList v-if="currentMode === 'browser'" />

    <!-- Local Mode: Multi-Vault Display -->
    <template v-else>
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
    </template>

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
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, ref, watch } from 'vue'
import { useFileSystem } from '../composables/useFileSystem'
import { useFileSystemStore } from '../stores/fileSystemStore'
import type { LocalFile } from '../types/fileSystem'
import FileList from './FileList.vue'
import LocalFileItem from './LocalFileItem.vue'

const fileSystemStore = useFileSystemStore()
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
const currentMode = ref<'browser' | 'local'>('browser')
const showError = ref(false)
const errorMessage = ref('')
const savedVaultNames = ref<Array<{ id: string; name: string }>>([])

// Watch for errors
watch(error, (newError) => {
  if (newError) {
    errorMessage.value = newError
    showError.value = true
  }
})

// Sync mode with store
watch(
  () => fileSystemStore.isLocalMode,
  (isLocal) => {
    if (isLocal && currentMode.value !== 'local') {
      currentMode.value = 'local'
    }
  }
)

// Check for saved vaults and try to reconnect on mount
onMounted(async () => {
  // Try to reconnect to saved vaults
  const connectedCount = await reconnectVaults()
  
  if (connectedCount > 0) {
    currentMode.value = 'local'
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
    currentMode.value = 'local'
    // Remove from saved list if it was there
    savedVaultNames.value = savedVaultNames.value.filter(v => v.id !== vault.id)
  }
}

async function handleRemoveVault(vaultId: string) {
  await removeVault(vaultId)
  
  // If no vaults left, switch back to browser mode
  if (vaults.value.length === 0) {
    currentMode.value = 'browser'
  }
}

async function handleReconnectVault(vaultId: string) {
  const success = await fileSystemStore.requestVaultPermission(vaultId)
  if (success) {
    currentMode.value = 'local'
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

async function handleOpenFile(file: LocalFile, vaultId: string) {
  await openFile(file, vaultId)
}

function clearError() {
  showError.value = false
  clearStoreError()
}
</script>

<style scoped lang="scss">
.sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-sidebar);
}

.mode-switcher {
  padding: 8px;
  border-bottom: 1px solid var(--border-color);
}

.mode-toggle {
  width: 100%;
  display: flex;
  
  :deep(.v-btn) {
    flex: 1;
    border-radius: 6px !important;
    text-transform: none;
    font-weight: 500;
    font-size: 12px;
    letter-spacing: 0;
  }
  
  :deep(.v-btn-group) {
    width: 100%;
  }
}

.mode-btn {
  &.v-btn--active {
    background: linear-gradient(
      135deg,
      rgba(var(--v-theme-primary), 0.15) 0%,
      rgba(var(--v-theme-primary), 0.08) 100%
    ) !important;
    color: rgb(var(--v-theme-primary)) !important;
  }
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
