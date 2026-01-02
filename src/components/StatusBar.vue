<template>
  <div class="status-bar">
    <!-- Left Section: File Info -->
    <div class="status-section left">
      <!-- Document Info -->
      <div class="status-item" v-if="activeTab">
        <v-icon size="12" class="mr-1">mdi-file-document-outline</v-icon>
        <span class="status-text">{{ activeTab.name }}</span>
      </div>
      
      <!-- Word/Char Count -->
      <div class="status-item" v-if="activeTab">
        <v-icon size="12" class="mr-1">mdi-format-letter-case</v-icon>
        <span class="status-text">{{ charCount }} chars</span>
        <span class="status-separator">|</span>
        <span class="status-text">{{ wordCount }} words</span>
        <span class="status-separator">|</span>
        <span class="status-text">{{ lineCount }} lines</span>
      </div>
    </div>

    <!-- Center Section: Sync Status -->
    <div class="status-section center">
      <!-- Sync Status Indicator -->
      <div 
        class="status-item sync-status" 
        :class="syncStatusClass"
        @click="openSettings"
        title="Click to open settings"
      >
        <v-icon size="12" class="mr-1" :class="{ 'syncing': isSyncing }">
          {{ syncIcon }}
        </v-icon>
        <span class="status-text">{{ syncStatusText }}</span>
      </div>

      <!-- Last Sync Time -->
      <div class="status-item" v-if="lastSyncTimeText">
        <v-icon size="12" class="mr-1">mdi-clock-outline</v-icon>
        <span class="status-text">Synced: {{ lastSyncTimeText }}</span>
      </div>
    </div>

    <!-- Right Section: Provider & Auto-Sync -->
    <div class="status-section right">
      <!-- Auto-Sync Status -->
      <div 
        class="status-item" 
        v-if="isGoogleProvider"
        :class="{ 'auto-sync-on': autoSyncEnabled }"
      >
        <v-icon size="12" class="mr-1">
          {{ autoSyncEnabled ? 'mdi-sync' : 'mdi-sync-off' }}
        </v-icon>
        <span class="status-text">
          {{ autoSyncEnabled ? `Auto (${syncInterval}m)` : 'Manual' }}
        </span>
      </div>

      <!-- Storage Provider -->
      <div class="status-item provider-badge" :class="providerClass">
        <v-icon size="12" class="mr-1">{{ providerIcon }}</v-icon>
        <span class="status-text">{{ providerText }}</span>
      </div>

      <!-- Total Files Count -->
      <div class="status-item">
        <v-icon size="12" class="mr-1">mdi-folder-multiple-outline</v-icon>
        <span class="status-text">{{ tabCount }} files</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useGoogleDocs } from '../composables/useGoogleDocs'
import { useSettingsStore } from '../stores/settingsStore'
import { useTabsStore } from '../stores/tabsStore'

const tabsStore = useTabsStore()
const settingsStore = useSettingsStore()
const googleDocs = useGoogleDocs()

// Reactive time for auto-updating relative timestamps
const currentTime = ref(Date.now())
let timeUpdateInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // Update currentTime every 30 seconds for relative time display
  timeUpdateInterval = setInterval(() => {
    currentTime.value = Date.now()
  }, 30000)
})

onUnmounted(() => {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval)
    timeUpdateInterval = null
  }
})

// Active Tab
const activeTab = computed(() => tabsStore.activeTab)

// Document Stats
const charCount = computed(() => {
  const content = activeTab.value?.content || ''
  return content.length
})

const wordCount = computed(() => {
  const content = activeTab.value?.content || ''
  if (!content.trim()) return 0
  // Count words (supports CJK characters as individual words)
  const cjkChars = content.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff]/g)?.length || 0
  const words = content.trim().split(/\s+/).filter(w => w.length > 0 && !/^[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff]+$/.test(w)).length
  return words + cjkChars
})

const lineCount = computed(() => {
  const content = activeTab.value?.content || ''
  if (!content) return 0
  return content.split('\n').length
})

// Tab Count
const tabCount = computed(() => tabsStore.tabs.length)

// Provider Info
const isGoogleProvider = computed(() => settingsStore.settings.provider === 'google')
const providerClass = computed(() => isGoogleProvider.value ? 'google' : 'local')
const providerIcon = computed(() => isGoogleProvider.value ? 'mdi-google-drive' : 'mdi-laptop')
const providerText = computed(() => isGoogleProvider.value ? 'Google Drive' : 'Local')

// Auto-Sync
const autoSyncEnabled = computed(() => settingsStore.settings.autoSync && isGoogleProvider.value)
const syncInterval = computed(() => settingsStore.settings.syncIntervalMinutes)

// Sync Status
const isSyncing = computed(() => googleDocs.syncStatus.value.isSyncing)
const isConnected = computed(() => googleDocs.isConnected.value)
const hasError = computed(() => !!googleDocs.syncStatus.value.error)

const syncStatusClass = computed(() => {
  if (!isGoogleProvider.value) return 'local'
  if (isSyncing.value) return 'syncing'
  if (hasError.value) return 'error'
  if (isConnected.value) return 'connected'
  return 'disconnected'
})

const syncIcon = computed(() => {
  if (!isGoogleProvider.value) return 'mdi-harddisk'
  if (isSyncing.value) return 'mdi-cloud-sync'
  if (hasError.value) return 'mdi-cloud-alert'
  if (isConnected.value) return 'mdi-cloud-check'
  return 'mdi-cloud-off-outline'
})

const syncStatusText = computed(() => {
  if (!isGoogleProvider.value) return 'Local Storage'
  if (isSyncing.value) return 'Syncing...'
  if (hasError.value) return 'Sync Error'
  if (isConnected.value) return 'Connected'
  return 'Disconnected'
})

// Last Sync Time (auto-updates every 30 seconds via currentTime dependency)
const lastSyncTimeText = computed(() => {
  const lastSync = googleDocs.syncStatus.value.lastSyncTime
  if (!lastSync || !isGoogleProvider.value) return null
  
  // Use currentTime as dependency to trigger re-computation
  const now = currentTime.value
  const diff = now - lastSync
  
  // 小於 1 分鐘：顯示 "Just now"
  if (diff < 60000) {
    return 'Just now'
  }
  // 小於 1 小時：顯示 "Xm ago"
  else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return `${minutes}m ago`
  }
  // 超過 1 小時：顯示實際時間（例如 "11:34" 或 "Jan 2, 11:34"）
  else {
    const syncDate = new Date(lastSync)
    const nowDate = new Date(now)
    const isToday = syncDate.toDateString() === nowDate.toDateString()
    
    if (isToday) {
      return syncDate.toLocaleTimeString('en-US', { 
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    } else {
      return syncDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    }
  }
})

// Open Settings
function openSettings() {
  settingsStore.openSettingsDialog()
}
</script>

<style scoped lang="scss">
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;
  padding: 0 12px;
  background: var(--bg-surface);
  border-top: 1px solid var(--border-color);
  font-size: 11px;
  color: var(--text-secondary);
  user-select: none;
  flex-shrink: 0;
}

.status-section {
  display: flex;
  align-items: center;
  gap: 12px;
  
  &.left {
    flex: 1;
    justify-content: flex-start;
  }
  
  &.center {
    flex: 1;
    justify-content: center;
  }
  
  &.right {
    flex: 1;
    justify-content: flex-end;
  }
}

.status-item {
  display: flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
  
  .v-icon {
    opacity: 0.7;
  }
  
  &.sync-status {
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all 0.2s ease;
    
    &:hover {
      background: var(--bg-surface-hover);
    }
    
    &.connected {
      color: var(--color-success, #4caf50);
    }
    
    &.syncing {
      color: var(--color-primary, #2196f3);
      
      .syncing {
        animation: spin 1s linear infinite;
      }
    }
    
    &.error {
      color: var(--color-error, #f44336);
    }
    
    &.disconnected {
      color: var(--text-disabled, #888);
    }
    
    &.local {
      color: var(--text-secondary);
    }
  }
  
  &.auto-sync-on {
    color: var(--color-success, #4caf50);
  }
  
  &.provider-badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
    
    &.google {
      background: rgba(66, 133, 244, 0.15);
      color: #4285f4;
    }
    
    &.local {
      background: rgba(158, 158, 158, 0.15);
      color: var(--text-secondary);
    }
  }
}

.status-text {
  line-height: 1;
}

.status-separator {
  margin: 0 4px;
  opacity: 0.4;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

// Responsive: hide some items on smaller screens
@media (max-width: 768px) {
  .status-section.center {
    display: none;
  }
  
  .status-section.left,
  .status-section.right {
    flex: 1;
  }
}

@media (max-width: 480px) {
  .status-bar {
    padding: 0 8px;
    font-size: 10px;
    gap: 8px;
  }
  
  .status-section {
    gap: 8px;
  }
  
  .status-separator {
    display: none;
  }
}
</style>
