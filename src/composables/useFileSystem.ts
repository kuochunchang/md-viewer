/**
 * useFileSystem Composable
 * High-level composable for file system operations with multi-vault Obsidian integration
 * Provides a unified API for working with local files and browser storage
 */

import { storeToRefs } from 'pinia'
import type { ComputedRef } from 'vue'
import { computed, watch } from 'vue'
import { useFileSystemStore } from '../stores/fileSystemStore'
import { useTabsStore } from '../stores/tabsStore'
import type { LocalFile, VaultInfo } from '../types/fileSystem'

export interface UseFileSystemReturn {
    // State
    isSupported: ComputedRef<boolean>
    isLocalMode: ComputedRef<boolean>
    hasVaults: ComputedRef<boolean>
    vaults: ComputedRef<VaultInfo[]>
    isLoading: ComputedRef<boolean>
    error: ComputedRef<string | null>

    // Vault operations
    addVault: () => Promise<VaultInfo | null>
    removeVault: (vaultId: string) => Promise<void>
    reconnectVaults: () => Promise<number>
    toggleVaultExpanded: (vaultId: string) => void
    toggleDirectoryExpanded: (vaultId: string, dirPath: string) => void
    refreshVault: (vaultId: string) => Promise<boolean>

    // File operations
    openFile: (file: LocalFile, vaultId?: string) => Promise<void>
    saveCurrentFile: () => Promise<boolean>
    createNewFile: (vaultId: string, name?: string) => Promise<LocalFile | null>

    // Change detection
    checkExternalChange: () => Promise<boolean>
    reloadCurrentFile: () => Promise<void>

    // Mode operations
    switchToBrowserMode: () => void

    // Utility
    clearError: () => void
}

// Global mappings between tabs and file info
// This ensures state is shared across multiple usages of the composable
interface FileInfo {
    vaultId: string
    filePath: string
}
const tabToFileInfo = new Map<string, FileInfo>()
const filePathToTab = new Map<string, string>()

export function useFileSystem(): UseFileSystemReturn {
    const fileSystemStore = useFileSystemStore()
    const tabsStore = useTabsStore()

    const {
        isSupported,
        isLocalMode,
        hasVaults,
        vaults,
        isLoading,
        error
    } = storeToRefs(fileSystemStore)

    // Open a local file and create a tab for it
    async function openFile(file: LocalFile, vaultId?: string): Promise<void> {
        // Check if file is already open
        const existingTabId = filePathToTab.get(file.path)
        if (existingTabId) {
            tabsStore.setActiveTab(existingTabId)
            fileSystemStore.setCurrentFile(file.handle, file.path)
            return
        }

        try {
            const content = await fileSystemStore.readFile(file.handle)

            // Create a new tab with the file content
            // Remove .md extension for display name
            const displayName = file.name.replace(/\.md$/, '').replace(/\.markdown$/, '')
            const tabId = tabsStore.addTabWithContent(displayName, content, null)

            // Track the mapping (include vaultId for multi-vault support)
            if (vaultId) {
                tabToFileInfo.set(tabId, { vaultId, filePath: file.path })
            } else {
                // Try to find which vault this file belongs to
                for (const vault of vaults.value) {
                    const found = fileSystemStore.findFileInVault(vault.id, file.path)
                    if (found) {
                        tabToFileInfo.set(tabId, { vaultId: vault.id, filePath: file.path })
                        break
                    }
                }
            }
            filePathToTab.set(file.path, tabId)

            // Set as current file for saving
            fileSystemStore.setCurrentFile(file.handle, file.path)
        } catch (err) {
            console.error('Failed to open file:', err)
        }
    }

    // Save the current active tab to its corresponding local file
    async function saveCurrentFile(): Promise<boolean> {
        if (!isLocalMode.value) return false

        const activeTab = tabsStore.activeTab
        if (!activeTab) return false

        const fileInfo = tabToFileInfo.get(activeTab.id)
        if (!fileInfo) {
            // This tab doesn't have a corresponding local file
            return false
        }

        const file = fileSystemStore.findFileByPath(fileInfo.filePath)
        if (!file) return false

        try {
            // Request permission if needed
            const permission = await file.handle.queryPermission({ mode: 'readwrite' })
            if (permission !== 'granted') {
                const newPermission = await file.handle.requestPermission({ mode: 'readwrite' })
                if (newPermission !== 'granted') return false
            }

            const success = await fileSystemStore.saveFile(file.handle, activeTab.content)

            if (success) {
                // Update the file's lastModified (trigger reactivity)
                const updatedFile = await file.handle.getFile()
                file.lastModified = updatedFile.lastModified
            }
            return success
        } catch (error) {
            console.error('[FileSystem] Save exception:', error)
            return false
        }
    }

    // Create a new file in a vault
    async function createNewFile(vaultId: string, name?: string): Promise<LocalFile | null> {
        const fileName = name || `New Document ${Date.now()}`
        const file = await fileSystemStore.createFileInVault(vaultId, fileName, '')

        if (file) {
            await openFile(file, vaultId)
        }

        return file
    }

    // Switch back to browser mode
    function switchToBrowserMode(): void {
        tabToFileInfo.clear()
        filePathToTab.clear()
        fileSystemStore.closeAllVaults()
    }

    // Clear error message
    function clearError(): void {
        fileSystemStore.clearError()
    }

    // Clean up mappings when tabs are closed
    watch(
        () => tabsStore.tabs.length,
        () => {
            // Remove mappings for tabs that no longer exist
            const tabIds = new Set(tabsStore.tabs.map(t => t.id))

            for (const [tabId, fileInfo] of tabToFileInfo.entries()) {
                if (!tabIds.has(tabId)) {
                    tabToFileInfo.delete(tabId)
                    filePathToTab.delete(fileInfo.filePath)
                }
            }
        }
    )

    // Update current file when active tab changes
    watch(
        () => tabsStore.activeTabId,
        (newTabId) => {
            if (!newTabId || !isLocalMode.value) return

            const fileInfo = tabToFileInfo.get(newTabId)
            if (fileInfo) {
                const file = fileSystemStore.findFileByPath(fileInfo.filePath)
                if (file) {
                    fileSystemStore.setCurrentFile(file.handle, fileInfo.filePath)
                }
            } else {
                fileSystemStore.setCurrentFile(null, null)
            }
        }
    )

    // Check if the current file has been modified externally
    async function checkExternalChange(): Promise<boolean> {
        if (!isLocalMode.value) return false

        const activeTab = tabsStore.activeTab
        if (!activeTab) return false

        const fileInfo = tabToFileInfo.get(activeTab.id)
        if (!fileInfo) return false

        const file = fileSystemStore.findFileByPath(fileInfo.filePath)
        if (!file || !file.lastModified) return false

        try {
            const diskFile = await file.handle.getFile()
            // If disk file is newer than our internal record (with 1s tolerance)
            if (diskFile.lastModified > file.lastModified + 1000) {
                console.log('[FileSystem] External change detected:', fileInfo.filePath)
                return true
            }
        } catch (err) {
            console.error('Failed to check file status:', err)
        }

        return false
    }

    // Reload the current file from disk
    async function reloadCurrentFile(): Promise<void> {
        const activeTab = tabsStore.activeTab
        if (!activeTab) return

        const fileInfo = tabToFileInfo.get(activeTab.id)
        if (!fileInfo) return

        const file = fileSystemStore.findFileByPath(fileInfo.filePath)
        if (!file) return

        try {
            const content = await fileSystemStore.readFile(file.handle)
            const diskFile = await file.handle.getFile()

            // Update tab content
            tabsStore.updateTabContent(activeTab.id, content)

            // Update lastModified
            file.lastModified = diskFile.lastModified
        } catch (err) {
            console.error('Failed to reload file:', err)
        }
    }

    return {
        // State (computed refs)
        isSupported: computed(() => isSupported.value),
        isLocalMode: computed(() => isLocalMode.value),
        hasVaults: computed(() => hasVaults.value),
        vaults: computed(() => vaults.value),
        isLoading: computed(() => isLoading.value),
        error: computed(() => error.value),

        // Vault operations
        addVault: () => fileSystemStore.addVault(),
        removeVault: (vaultId: string) => fileSystemStore.removeVault(vaultId),
        reconnectVaults: () => fileSystemStore.reconnectVaults(),
        toggleVaultExpanded: (vaultId: string) => fileSystemStore.toggleVaultExpanded(vaultId),
        toggleDirectoryExpanded: (vaultId: string, dirPath: string) => fileSystemStore.toggleDirectoryExpanded(vaultId, dirPath),
        refreshVault: (vaultId: string) => fileSystemStore.refreshVault(vaultId),

        // File operations
        openFile,
        saveCurrentFile,
        createNewFile,

        // Change detection
        checkExternalChange,
        reloadCurrentFile,

        // Mode operations
        switchToBrowserMode,

        // Utility
        clearError
    }
}

// Get file info for a tab (if it's a local file)
export function getTabFileInfo(tabId: string): FileInfo | null {
    return tabToFileInfo.get(tabId) || null
}

// Check if a tab is a local file
export function isTabLocalFile(tabId: string): boolean {
    return tabToFileInfo.has(tabId)
}
