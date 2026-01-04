/**
 * 設定 Store
 * 管理應用程式設定
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface SyncSettings {
    // Reserved for future use with Git sync or other settings
    placeholder?: boolean
}

const SETTINGS_STORAGE_KEY = 'md-viewer-settings'

const defaultSettings: SyncSettings = {
    placeholder: true
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
        openSettingsDialog,
        closeSettingsDialog,
        resetToDefaults
    }
})
