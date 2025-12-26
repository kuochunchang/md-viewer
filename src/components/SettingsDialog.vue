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
          <span class="text-h6 font-weight-bold">設定</span>
        </div>
        <v-btn icon variant="text" size="small" @click="closeDialog">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider></v-divider>

      <v-card-text class="dialog-content pa-0">
        <!-- 儲存設定區塊 -->
        <div class="settings-section">
          <div class="section-header">
            <v-icon size="small" color="primary" class="mr-2">mdi-cloud-sync</v-icon>
            <span class="section-title">資料儲存</span>
          </div>
          
          <div class="section-content">
            <!-- 儲存位置選擇 -->
            <div class="setting-item">
              <div class="setting-label">
                <span class="setting-name">儲存位置</span>
                <span class="setting-description">選擇您的資料要儲存在哪裡</span>
              </div>
              <v-btn-toggle 
                v-model="localSettings.provider" 
                mandatory 
                density="compact"
                class="provider-toggle"
              >
                <v-btn value="local" size="small" :color="localSettings.provider === 'local' ? 'primary' : undefined">
                  <v-icon start size="18">mdi-laptop</v-icon>
                  本地
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
                <!-- 連線狀態 -->
                <div class="setting-item connection-status">
                  <div class="setting-label">
                    <span class="setting-name">連線狀態</span>
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
                        登出
                      </v-btn>
                    </template>
                    <template v-else>
                      <v-chip color="grey" size="small" variant="tonal">
                        <v-icon start size="16">mdi-cloud-off-outline</v-icon>
                        未連線
                      </v-chip>
                    </template>
                  </div>
                </div>

                <!-- Google Client ID 設定 -->
                <div class="setting-item flex-column" v-if="!googleDocs.isConnected.value">
                  <div class="setting-label w-100 mb-2">
                    <span class="setting-name">Google Client ID</span>
                    <span class="setting-description">
                      <a href="https://console.cloud.google.com/apis/credentials" target="_blank" class="text-primary">
                        從 Google Cloud Console 取得
                        <v-icon size="12">mdi-open-in-new</v-icon>
                      </a>
                    </span>
                  </div>
                  <v-text-field
                    v-model="clientIdInput"
                    placeholder="輸入您的 Client ID"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="w-100 mb-2"
                  ></v-text-field>
                  
                  <!-- Redirect URI 設定提示 -->
                  <v-alert 
                    type="warning" 
                    variant="tonal" 
                    density="compact"
                    class="w-100 mt-2"
                  >
                    <div class="text-caption">
                      <strong>重要：</strong>請在 Google Cloud Console 的 OAuth Client 設定中加入以下網址：
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

                <!-- 登入按鈕 -->
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
                    連接 Google 帳號
                  </v-btn>
                </div>

                <!-- 自動同步設定 -->
                <template v-if="googleDocs.isConnected.value">
                  <div class="setting-item">
                    <div class="setting-label">
                      <span class="setting-name">自動同步</span>
                      <span class="setting-description">定時自動將資料同步到雲端</span>
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
                        <span class="setting-name">同步間隔</span>
                        <span class="setting-description">每隔多久自動同步一次</span>
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

                  <!-- 遷移提示 (尚未有雲端檔案時顯示) -->
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
                          偵測到 {{ localDataStats.tabCount }} 個本地文件
                        </span>
                      </div>
                      <v-btn 
                        size="x-small" 
                        variant="flat" 
                        color="primary"
                        @click="showMigrationDialog = true"
                      >
                        遷移到雲端
                      </v-btn>
                    </div>
                  </v-alert>

                  <!-- 手動同步按鈕 -->
                  <div class="setting-item sync-actions">
                    <v-btn 
                      color="primary" 
                      variant="tonal"
                      size="small"
                      :loading="googleDocs.syncStatus.value.isSyncing"
                      @click="handleManualSync"
                    >
                      <v-icon start size="18">mdi-cloud-upload</v-icon>
                      立即同步到雲端
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
                      從雲端載入
                    </v-btn>
                  </div>

                  <!-- 最後同步時間 -->
                  <div v-if="googleDocs.syncStatus.value.lastSyncTime" class="last-sync-time">
                    <v-icon size="14" class="mr-1">mdi-clock-outline</v-icon>
                    最後同步: {{ formatTime(googleDocs.syncStatus.value.lastSyncTime) }}
                  </div>

                  <!-- 同步錯誤 -->
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

            <!-- 本地儲存說明 -->
            <v-alert 
              v-if="localSettings.provider === 'local'" 
              type="info" 
              variant="tonal" 
              density="compact"
              class="mt-3"
            >
              <p class="mb-0 text-caption">
                資料儲存在瀏覽器的 <strong>localStorage</strong> 中。
                清除瀏覽器資料會導致資料遺失。
              </p>
            </v-alert>
          </div>
        </div>

        <v-divider></v-divider>

        <!-- 安全性說明 -->
        <div class="settings-section">
          <div class="section-header">
            <v-icon size="small" color="primary" class="mr-2">mdi-shield-check</v-icon>
            <span class="section-title">安全性</span>
          </div>
          
          <div class="section-content">
            <v-alert type="success" variant="tonal" density="compact">
              <div class="d-flex align-start gap-2">
                <v-icon size="20">mdi-lock-outline</v-icon>
                <div>
                  <p class="mb-1 font-weight-medium">您的資料安全</p>
                  <ul class="security-list text-caption">
                    <li>所有登入資訊都只存在您的瀏覽器中</li>
                    <li>伺服器不會儲存任何個人資訊或登入憑證</li>
                    <li>Google Drive 中只會存取由本應用建立的檔案</li>
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
          重設為預設值
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn variant="flat" color="primary" @click="saveAndClose">
          儲存設定
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- 資料遷移對話框 -->
  <v-dialog 
    v-model="showMigrationDialog" 
    max-width="450" 
    persistent
  >
    <v-card class="migration-dialog-card">
      <v-card-title class="dialog-header d-flex align-center gap-2">
        <v-icon color="primary">mdi-database-arrow-up</v-icon>
        <span class="text-h6 font-weight-bold">資料遷移</span>
      </v-card-title>

      <v-divider></v-divider>

      <v-card-text class="pa-5">
        <div class="migration-content">
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            <div class="d-flex align-center gap-2">
              <v-icon>mdi-information</v-icon>
              <span class="font-weight-medium">偵測到本地資料</span>
            </div>
          </v-alert>

          <p class="text-body-2 mb-4">
            您的瀏覽器中已有 <strong>{{ localDataStats.tabCount }} 個文件</strong> 
            <span v-if="localDataStats.folderCount > 0">和 <strong>{{ localDataStats.folderCount }} 個資料夾</strong></span>。
          </p>

          <p class="text-body-2 mb-4">
            是否要將這些資料遷移到 Google Drive？
          </p>

          <v-alert type="warning" variant="tonal" density="compact" class="mb-0">
            <p class="text-caption mb-0">
              <strong>注意：</strong>遷移後，您的資料將同時存在本地和雲端。
              未來的變更將根據您的設定同步到選定的儲存位置。
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
          暫時跳過
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn 
          variant="flat" 
          color="primary"
          :loading="isMigrating"
          @click="performMigration"
        >
          <v-icon start>mdi-cloud-upload</v-icon>
          開始遷移
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- 遷移成功提示 -->
  <v-snackbar 
    v-model="showMigrationSuccess" 
    color="success" 
    :timeout="4000"
    location="top"
  >
    <div class="d-flex align-center gap-2">
      <v-icon>mdi-check-circle</v-icon>
      <span>資料已成功遷移到 Google Drive！</span>
    </div>
  </v-snackbar>

  <!-- 遷移失敗提示 -->
  <v-snackbar 
    v-model="showMigrationError" 
    color="error" 
    :timeout="5000"
    location="top"
  >
    <div class="d-flex align-center gap-2">
      <v-icon>mdi-alert-circle</v-icon>
      <span>資料遷移失敗：{{ migrationErrorMessage }}</span>
    </div>
  </v-snackbar>

  <!-- Google Drive 衝突提示對話框 -->
  <v-dialog v-model="showConflictDialog" max-width="450">
    <v-card>
      <v-card-title class="text-h6 bg-warning text-white">
        <v-icon start icon="mdi-alert" color="white"></v-icon>
        偵測到同步衝突
      </v-card-title>
      <v-card-text class="pt-4">
        <p class="mb-2">雲端上的檔案比您目前的版本還要新，這表示可能在其他裝置上有進行編輯。</p>
        <p class="text-error font-weight-bold">如果您繼續同步，將會覆蓋雲端上的最新版本！</p>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="showConflictDialog = false">取消</v-btn>
        <v-btn color="warning" @click="confirmForceSync">強制覆蓋</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { useSettingsStore, type SyncSettings } from '../stores/settingsStore'
import { useGoogleDocs } from '../composables/useGoogleDocs'
import { useTabsStore } from '../stores/tabsStore'

const settingsStore = useSettingsStore()
const googleDocs = useGoogleDocs()
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
  { text: '1 分鐘', value: 1 },
  { text: '5 分鐘', value: 5 },
  { text: '10 分鐘', value: 10 },
  { text: '15 分鐘', value: 15 },
  { text: '30 分鐘', value: 30 },
  { text: '1 小時', value: 60 }
]

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
  if (isConnected && !wasConnected && shouldOfferMigration.value) {
    // Small delay to let the UI update
    setTimeout(() => {
      showMigrationDialog.value = true
    }, 500)
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
    const success = await googleDocs.signIn()
    
    // After successful sign-in, check if migration should be offered
    if (success && shouldOfferMigration.value) {
      // Small delay for UI to update
      setTimeout(() => {
        showMigrationDialog.value = true
      }, 500)
    }
  } finally {
    isSigningIn.value = false
  }
}

function handleSignOut() {
  googleDocs.signOut()
}

async function handleManualSync() {
  const data = tabsStore.getDataForExport()
  // 嘗試同步（不強制覆蓋）
  const result = await googleDocs.syncToGoogleDocs(data, false)
  
  if (result === 'conflict') {
    showConflictDialog.value = true
  }
}

async function confirmForceSync() {
  showConflictDialog.value = false
  // 強制同步
  const data = tabsStore.getDataForExport()
  await googleDocs.syncToGoogleDocs(data, true)
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

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-TW', {
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
    syncIntervalMinutes: 5
  }
}

function saveAndClose() {
  // 儲存設定
  settingsStore.setProvider(localSettings.value.provider)
  settingsStore.setAutoSync(localSettings.value.autoSync)
  settingsStore.setSyncInterval(localSettings.value.syncIntervalMinutes)
  
  closeDialog()
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
    const success = await googleDocs.syncToGoogleDocs(data)
    
    if (success) {
      showMigrationDialog.value = false
      showMigrationSuccess.value = true
      
      // Automatically switch to Google storage provider
      localSettings.value.provider = 'google'
      settingsStore.setProvider('google')
    } else {
      migrationErrorMessage.value = googleDocs.syncStatus.value.error || '未知錯誤'
      showMigrationError.value = true
    }
  } catch (error) {
    migrationErrorMessage.value = (error as Error).message || '遷移過程發生錯誤'
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
</style>
