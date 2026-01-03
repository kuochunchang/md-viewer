/**
 * useFileSystem Composable
 * High-level composable for file system operations with Obsidian integration
 * Provides a unified API for working with local files and browser storage
 */

import { storeToRefs } from 'pinia'
import type { ComputedRef } from 'vue'
import { computed, watch } from 'vue'
import { useFileSystemStore } from '../stores/fileSystemStore'
import { useTabsStore } from '../stores/tabsStore'
import type { LocalDirectory, LocalFile } from '../types/fileSystem'

export interface UseFileSystemReturn {
    // State
    isSupported: ComputedRef<boolean>
    isLocalMode: ComputedRef<boolean>
    hasVault: ComputedRef<boolean>
    vaultName: ComputedRef<string>
    isLoading: ComputedRef<boolean>
    error: ComputedRef<string | null>
    entries: ComputedRef<(LocalFile | LocalDirectory)[]>

    // Vault operations
    openVault: () => Promise<boolean>
    closeVault: () => void
    refreshVault: () => Promise<boolean>

    // File operations
    openFile: (file: LocalFile) => Promise<void>
    saveCurrentFile: () => Promise<boolean>
    createNewFile: (name?: string) => Promise<LocalFile | null>

    // Mode operations
    switchToBrowserMode: () => void

    // Utility
    clearError: () => void
}

export function useFileSystem(): UseFileSystemReturn {
    const fileSystemStore = useFileSystemStore()
    const tabsStore = useTabsStore()

    const {
        isSupported,
        isLocalMode,
        hasVault,
        vaultName,
        isLoading,
        error,
        entries
    } = storeToRefs(fileSystemStore)

    // Map from tab ID to file path (for local files)
    const tabToFilePath = new Map<string, string>()
    const filePathToTab = new Map<string, string>()

    // Open a local file and create a tab for it
    async function openFile(file: LocalFile): Promise<void> {
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

            // Track the mapping
            tabToFilePath.set(tabId, file.path)
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

        const filePath = tabToFilePath.get(activeTab.id)
        if (!filePath) {
            // This tab doesn't have a corresponding local file
            // Could create a new file, but for now just return false
            return false
        }

        const file = fileSystemStore.findFileByPath(filePath)
        if (!file) return false

        const success = await fileSystemStore.saveFile(file.handle, activeTab.content)

        if (success) {
            // Update the file's lastModified (trigger reactivity)
            const updatedFile = await file.handle.getFile()
            file.lastModified = updatedFile.lastModified
        }

        return success
    }

    // Create a new file in the vault root
    async function createNewFile(name?: string): Promise<LocalFile | null> {
        if (!hasVault.value) return null

        const fileName = name || `New Document ${Date.now()}`
        const file = await fileSystemStore.createFileInRoot(fileName, '')

        if (file) {
            await openFile(file)
        }

        return file
    }

    // Open the vault picker
    async function openVault(): Promise<boolean> {
        // Clear existing mappings when opening a new vault
        tabToFilePath.clear()
        filePathToTab.clear()

        return await fileSystemStore.openVault()
    }

    // Close the vault and switch to browser mode
    function closeVault(): void {
        tabToFilePath.clear()
        filePathToTab.clear()
        fileSystemStore.closeVault()
    }

    // Switch back to browser mode without forgetting the vault
    function switchToBrowserMode(): void {
        tabToFilePath.clear()
        filePathToTab.clear()
        fileSystemStore.closeVault()
    }

    // Refresh vault contents
    async function refreshVault(): Promise<boolean> {
        return await fileSystemStore.refreshVault()
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

            for (const [tabId, filePath] of tabToFilePath.entries()) {
                if (!tabIds.has(tabId)) {
                    tabToFilePath.delete(tabId)
                    filePathToTab.delete(filePath)
                }
            }
        }
    )

    // Update current file when active tab changes
    watch(
        () => tabsStore.activeTabId,
        (newTabId) => {
            if (!newTabId || !isLocalMode.value) return

            const filePath = tabToFilePath.get(newTabId)
            if (filePath) {
                const file = fileSystemStore.findFileByPath(filePath)
                if (file) {
                    fileSystemStore.setCurrentFile(file.handle, filePath)
                }
            } else {
                fileSystemStore.setCurrentFile(null, null)
            }
        }
    )

    return {
        // State (computed refs)
        isSupported: computed(() => isSupported.value),
        isLocalMode: computed(() => isLocalMode.value),
        hasVault: computed(() => hasVault.value),
        vaultName: computed(() => vaultName.value),
        isLoading: computed(() => isLoading.value),
        error: computed(() => error.value),
        entries: computed(() => entries.value),

        // Vault operations
        openVault,
        closeVault,
        refreshVault,

        // File operations
        openFile,
        saveCurrentFile,
        createNewFile,

        // Mode operations
        switchToBrowserMode,

        // Utility
        clearError
    }
}

// Get file path for a tab (if it's a local file)
export function getTabFilePath(_tabId: string): string | null {
    // This needs to access the internal mappings, but since they're in the composable
    // we'll expose this through a different mechanism if needed
    return null
}

// Check if a tab is a local file
export function isTabLocalFile(_tabId: string): boolean {
    // Similar to above, this would need access to internal mappings
    return false
}
