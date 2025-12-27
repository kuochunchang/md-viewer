/**
 * 設定 Store
 * 管理應用程式設定，包括雲端同步選項
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type StorageProvider = 'local' | 'google'

export interface SyncSettings {
    provider: StorageProvider
    autoSync: boolean
    syncIntervalMinutes: number
    // Backup settings
    backupEnabled: boolean
    backupRetentionDays: number
}

const SETTINGS_STORAGE_KEY = 'md-viewer-settings'

const defaultSettings: SyncSettings = {
    provider: 'local',
    autoSync: false,
    syncIntervalMinutes: 5,
    // Backup defaults
    backupEnabled: false,
    backupRetentionDays: 7
}

export const useSettingsStore = defineStore('settings', () => {
    // State
    const settings = ref<SyncSettings>({ ...defaultSettings })
    const isSettingsDialogOpen = ref(false)

    // 載入設定
    function loadSettings() {
        try {
            const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
            if (stored) {
                const parsed = JSON.parse(stored) as Partial<SyncSettings>
                settings.value = {
                    ...defaultSettings,
                    ...parsed
                }
            }
        } catch (error) {
            console.error('Failed to load settings:', error)
            settings.value = { ...defaultSettings }
        }
    }

    // 儲存設定
    function saveSettings() {
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings.value))
        } catch (error) {
            console.error('Failed to save settings:', error)
        }
    }

    // 設定儲存提供者
    function setProvider(provider: StorageProvider) {
        settings.value.provider = provider
        saveSettings()
    }

    // 設定自動同步
    function setAutoSync(enabled: boolean) {
        settings.value.autoSync = enabled
        saveSettings()
    }

    // 設定同步間隔
    function setSyncInterval(minutes: number) {
        settings.value.syncIntervalMinutes = Math.max(1, Math.min(60, minutes))
        saveSettings()
    }

    // 設定備份開關
    function setBackupEnabled(enabled: boolean) {
        settings.value.backupEnabled = enabled
        saveSettings()
    }

    // 設定備份保留天數
    function setBackupRetentionDays(days: number) {
        settings.value.backupRetentionDays = Math.max(1, Math.min(30, days))
        saveSettings()
    }

    // 開啟設定對話框
    function openSettingsDialog() {
        isSettingsDialogOpen.value = true
    }

    // 關閉設定對話框
    function closeSettingsDialog() {
        isSettingsDialogOpen.value = false
    }

    // 重設為預設值
    function resetToDefaults() {
        settings.value = { ...defaultSettings }
        saveSettings()
    }

    // 監聽設定變化自動儲存
    watch(settings, () => {
        saveSettings()
    }, { deep: true })

    // 初始化
    loadSettings()

    return {
        // State
        settings,
        isSettingsDialogOpen,

        // Actions
        loadSettings,
        saveSettings,
        setProvider,
        setAutoSync,
        setSyncInterval,
        setBackupEnabled,
        setBackupRetentionDays,
        openSettingsDialog,
        closeSettingsDialog,
        resetToDefaults
    }
})
