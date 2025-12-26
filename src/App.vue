<template>
  <v-app class="app-wrapper">
    <v-navigation-drawer
      v-model="showSidebar"
      width="280"
      class="sidebar-drawer"
      floating
    >
      <FileList />
    </v-navigation-drawer>

    <v-app-bar class="app-header" flat height="48">
      <div class="d-flex align-center h-100 w-100 pl-2" style="overflow: hidden;">
        <!-- Menu Button (Fixed Left) -->
        <v-btn
          icon
          variant="text"
          size="small"
          class="nav-btn mr-2 flex-shrink-0"
          :title="showSidebar ? 'Hide Sidebar' : 'Show Sidebar'"
          @click="tabsStore.toggleSidebar"
        >
          <v-icon size="20">mdi-menu</v-icon>
        </v-btn>

        <!-- Tab Bar (Fluid Middle) -->
        <TabBar style="min-width: 0;" />
        
        <!-- Editor Toggle / Right Actions (Fixed Right) -->
        <div class="d-flex align-center pr-2 gap-2 flex-shrink-0">
           <v-btn
            icon
            variant="text"
            size="small"
            class="nav-btn"
            :title="showEditor ? 'Preview Mode' : 'Split Mode'"
            @click="tabsStore.toggleEditor"
          >
            <v-icon size="20">{{ showEditor ? 'mdi-book-open-outline' : 'mdi-book-open-variant' }}</v-icon>
          </v-btn>
          
          <v-divider vertical class="mx-2 my-auto" style="height: 20px" inset></v-divider>
          
          <SettingsMenu />
        </div>
      </div>
    </v-app-bar>

    <v-main>
      <div class="app-container">
        <SplitPane
          :initial-ratio="0.4"
          :min-ratio="0.1"
          :max-ratio="0.9"
          :collapsed="!showEditor"
        >
          <template #left>
            <MarkdownEditor
              ref="editorRef"
              :model-value="activeTabContent"
              :font-size="fontSize"
              @update:model-value="handleContentUpdate"
              @scroll="handleEditorScroll"
            />
          </template>
          <template #right>
            <MarkdownPreview
              ref="previewRef"
              :content="activeTabContent"
              :font-size="fontSize"
              @scroll="handlePreviewScroll"
            />
          </template>
        </SplitPane>
      </div>
    </v-main>


    <v-snackbar
      v-model="showConflictSnackbar"
      color="warning"
      location="top"
      :timeout="-1" 
      class="sync-conflict-snackbar"
    >
      <div class="d-flex align-center">
        <v-icon start icon="mdi-cloud-alert" color="white"></v-icon>
        <div class="mr-4 text-white">
          <div class="font-weight-bold">Sync Stopped</div>
          <div class="text-caption">Cloud data is newer</div>
        </div>
        <v-spacer></v-spacer>
        <v-btn variant="text" size="small" color="white" @click="openSettings">
          Resolve
        </v-btn>
        <v-btn icon size="x-small" variant="text" color="white" @click="showConflictSnackbar = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </div>
    </v-snackbar>

    <!-- Settings Dialog (Global) -->
    <SettingsDialog />
  </v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import FileList from './components/FileList.vue'
import MarkdownEditor from './components/MarkdownEditor.vue'
import MarkdownPreview from './components/MarkdownPreview.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import SettingsMenu from './components/SettingsMenu.vue'
import SplitPane from './components/SplitPane.vue'
import TabBar from './components/TabBar.vue'
import { useTabsStore } from './stores/tabsStore'
import { useGoogleDocs } from './composables/useGoogleDocs'
import { useSettingsStore } from './stores/settingsStore'

const tabsStore = useTabsStore()
const googleDocs = useGoogleDocs()
const settingsStore = useSettingsStore()

const activeTabContent = computed(() => tabsStore.activeTabContent)
const fontSize = computed(() => tabsStore.fontSize)
const showEditor = computed(() => tabsStore.showEditor)
const showSidebar = computed({
  get: () => tabsStore.showSidebar,
  set: (val) => {
    if (val !== tabsStore.showSidebar) {
      tabsStore.toggleSidebar()
    }
  }
})

// Scroll Sync Logic
const editorRef = ref<any>(null)
const previewRef = ref<any>(null)
const isSyncingLeft = ref(false)
const isSyncingRight = ref(false)

function handleEditorScroll(ratio: number) {
  if (isSyncingLeft.value) return
  isSyncingRight.value = true
  previewRef.value?.scrollToRatio(ratio)
  setTimeout(() => { isSyncingRight.value = false }, 50)
}

function handlePreviewScroll(ratio: number) {
  if (isSyncingRight.value) return
  isSyncingLeft.value = true
  editorRef.value?.scrollToRatio(ratio)
  setTimeout(() => { isSyncingLeft.value = false }, 50)
}

function handleContentUpdate(content: string) {
  if (tabsStore.activeTabId) {
    tabsStore.updateTabContent(tabsStore.activeTabId, content)
  }
}

// Auto-sync timer and dirty tracking
let autoSyncTimer: ReturnType<typeof setInterval> | null = null
let lastSyncedDataHash: string | null = null
const showConflictSnackbar = ref(false)

function openSettings() {
  showConflictSnackbar.value = false
  settingsStore.openSettingsDialog()
}

// 計算資料的 hash 用於比較
function getDataHash(data: object): string {
  return JSON.stringify(data)
}

// 檢查資料是否有變更
function hasDataChanged(): boolean {
  const currentData = tabsStore.getDataForExport()
  const currentHash = getDataHash(currentData)
  return currentHash !== lastSyncedDataHash
}

// 標記資料已同步
function markAsSynced() {
  const currentData = tabsStore.getDataForExport()
  lastSyncedDataHash = getDataHash(currentData)
}

function setupAutoSync() {
  // 清除舊的 timer
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer)
    autoSyncTimer = null
  }

  // 檢查是否應該啟用自動同步
  const shouldAutoSync = 
    settingsStore.settings.provider === 'google' &&
    settingsStore.settings.autoSync &&
    googleDocs.isConnected.value

  if (shouldAutoSync) {
    const intervalMs = settingsStore.settings.syncIntervalMinutes * 60 * 1000
    console.log(`[AutoSync] Starting auto-sync, interval: ${settingsStore.settings.syncIntervalMinutes} minutes`)
    
    autoSyncTimer = setInterval(async () => {
      if (googleDocs.isConnected.value && !googleDocs.syncStatus.value.isSyncing) {
        // 只有在資料有變更時才同步
        if (hasDataChanged()) {
          console.log('[AutoSync] Data changed, syncing...')
          const data = tabsStore.getDataForExport()
          // 自動同步時不強制覆蓋，遇到衝突則略過
          const result = await googleDocs.syncToGoogleDocs(data, false)
          
          if (result === 'success') {
            markAsSynced()
            console.log('[AutoSync] Sync successful')
          } else if (result === 'conflict') {
            console.warn('[AutoSync] Conflict detected, skipping sync to protect remote data')
            showConflictSnackbar.value = true
          }
        } else {
          console.log('[AutoSync] No changes, skipping sync')
        }
      }
    }, intervalMs)
  }
}

// 監聽設定變化以更新 auto-sync
watch(
  () => [
    settingsStore.settings.provider,
    settingsStore.settings.autoSync,
    settingsStore.settings.syncIntervalMinutes,
    googleDocs.isConnected.value
  ],
  () => {
    setupAutoSync()
  }
)

// Initialization
onMounted(() => {
  tabsStore.initialize()
  
  // 處理 Google OAuth 回調（如果從 Google 重定向回來）
  googleDocs.initialize()
  const oauthSuccess = googleDocs.handleOAuthCallback()
  
  // 如果 OAuth 成功，自動開啟設定對話框讓使用者看到連線狀態
  if (oauthSuccess) {
    // 稍微延遲以確保狀態已更新
    setTimeout(() => {
      settingsStore.openSettingsDialog()
    }, 500)
  }

  // 延遲設置 auto-sync（確保所有狀態都載入完成）
  setTimeout(() => {
    setupAutoSync()
  }, 1000)
})

// Cleanup
onUnmounted(() => {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer)
    autoSyncTimer = null
  }
})
</script>

<style scoped lang="scss">
// CSS Variables are defined in main.scss -> variables.scss globally
// No need to import variables.scss here unless using SCSS vars

.app-wrapper {
  background: var(--bg-app);
  height: 100vh;     // Force full viewport height
  overflow: hidden;  // Prevent global window scroll
}

.app-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden; // Ensure internal components handle scrolling
}

// Ensure v-main takes available space but doesn't overflow window
:deep(.v-main) {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

// Sidebar Customization
:deep(.sidebar-drawer) {
  background-color: var(--bg-sidebar) !important;
  border-right: 1px solid var(--border-color);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  .v-navigation-drawer__content {
    &::-webkit-scrollbar {
      width: 4px;
    }
  }
}

// Header Customization
:deep(.app-header) {
  background-color: var(--bg-header) !important;
  border-bottom: 1px solid var(--border-color) !important;
  backdrop-filter: blur(10px);
  z-index: 10;
  
  .v-toolbar__content {
    padding: 0;
    overflow: visible;
  }
}

.nav-btn {
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  
  &:hover {
    color: var(--text-primary);
    background-color: var(--bg-surface-hover);
  }
}
</style>
