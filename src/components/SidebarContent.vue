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

    <!-- Local Mode: Vault Tree or Open Vault Button -->
    <template v-else>
      <!-- Vault is open -->
      <LocalVaultTree 
        v-if="hasVault" 
        @close-vault="handleCloseVault"
      />

      <!-- No vault open - show prompt -->
      <div v-else class="vault-prompt">
        <div class="prompt-icon">
          <v-icon size="48" color="primary">mdi-folder-key-outline</v-icon>
        </div>
        <h3 class="prompt-title">Open Obsidian Vault</h3>
        <p class="prompt-description">
          Connect to a local folder to edit your Obsidian notes directly.
          Changes are saved instantly to your hard drive.
        </p>
        <v-btn
          color="primary"
          variant="elevated"
          size="large"
          :loading="isLoading"
          @click="handleOpenVault"
        >
          <v-icon start>mdi-folder-open-outline</v-icon>
          Select Folder
        </v-btn>

        <!-- Previously used vault prompt -->
        <div v-if="hasSavedVault" class="reconnect-prompt">
          <p>Or reconnect to your previous vault:</p>
          <v-btn
            variant="outlined"
            size="small"
            @click="handleReconnectVault"
          >
            <v-icon start size="16">mdi-refresh</v-icon>
            Reconnect
          </v-btn>
        </div>

        <!-- Not supported warning -->
        <div v-if="!isSupported" class="not-supported-warning">
          <v-icon color="warning" size="18">mdi-alert-outline</v-icon>
          <span>File System Access is not supported in this browser. 
            Please use Chrome, Edge, or Opera.</span>
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
import FileList from './FileList.vue'
import LocalVaultTree from './LocalVaultTree.vue'

const fileSystemStore = useFileSystemStore()
const { isLoading, error, isSupported } = storeToRefs(fileSystemStore)
const { hasVault, openVault, closeVault, clearError: clearStoreError } = useFileSystem()

// UI State
const currentMode = ref<'browser' | 'local'>('browser')
const hasSavedVault = ref(false)
const showError = ref(false)
const errorMessage = ref('')

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

// Check for saved vault on mount
onMounted(async () => {
  // Check if there's a saved vault handle in IndexedDB
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('md-viewer-fs', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles')
        }
      }
    })
    
    const tx = db.transaction('handles', 'readonly')
    const store = tx.objectStore('handles')
    const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve) => {
      const request = store.get('vaultHandle')
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => resolve(null)
    })
    
    db.close()
    hasSavedVault.value = handle !== null
  } catch {
    hasSavedVault.value = false
  }
})

async function handleOpenVault() {
  const success = await openVault()
  if (success) {
    currentMode.value = 'local'
  }
}

async function handleReconnectVault() {
  const success = await fileSystemStore.requestVaultPermission()
  if (success) {
    currentMode.value = 'local'
  }
}

function handleCloseVault() {
  closeVault()
  currentMode.value = 'browser'
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
