/**
 * File System Store - Manages local file system state for Obsidian integration
 * Supports multiple vaults with persistent handles stored in IndexedDB
 */

import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type {
    LocalDirectory,
    LocalFile,
    StorageMode,
    VaultInfo
} from '../types/fileSystem'
import { isFileSystemAccessSupported } from '../types/fileSystem'

// IndexedDB database name and store for persisting directory handles
const IDB_NAME = 'md-viewer-fs'
const IDB_STORE = 'vaults'
const IDB_VERSION = 2  // Bump version for multi-vault support

// Generate unique ID for vaults
function generateId(): string {
    return `vault-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export const useFileSystemStore = defineStore('fileSystem', () => {
    // State
    const mode = ref<StorageMode>('browser')
    const vaults = shallowRef<VaultInfo[]>([])  // Multiple vaults
    const currentFileHandle = shallowRef<FileSystemFileHandle | null>(null)
    const currentFilePath = ref<string | null>(null)
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const isSupported = ref(isFileSystemAccessSupported())

    // Computed
    const isLocalMode = computed(() => mode.value === 'local-fs')
    const hasVaults = computed(() => vaults.value.length > 0)

    // Get all entries from all vaults (flattened)
    const allEntries = computed(() => {
        const result: (LocalFile | LocalDirectory)[] = []
        for (const vault of vaults.value) {
            result.push(...vault.entries)
        }
        return result
    })

    // IndexedDB helpers for persisting multiple vault handles
    async function openIDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(IDB_NAME, IDB_VERSION)

            request.onerror = () => reject(request.error)
            request.onsuccess = () => resolve(request.result)

            request.onupgradeneeded = (event) => {
                const db = request.result
                const oldVersion = event.oldVersion

                // Delete old store if upgrading from version 1
                if (oldVersion < 2 && db.objectStoreNames.contains('handles')) {
                    db.deleteObjectStore('handles')
                }

                if (!db.objectStoreNames.contains(IDB_STORE)) {
                    db.createObjectStore(IDB_STORE, { keyPath: 'id' })
                }
            }
        })
    }

    // Save a vault handle to IndexedDB
    async function saveVaultToIDB(id: string, handle: FileSystemDirectoryHandle, name: string): Promise<void> {
        try {
            const db = await openIDB()
            const tx = db.transaction(IDB_STORE, 'readwrite')
            const store = tx.objectStore(IDB_STORE)

            await new Promise<void>((resolve, reject) => {
                const request = store.put({ id, handle, name, lastOpened: Date.now() })
                request.onsuccess = () => resolve()
                request.onerror = () => reject(request.error)
            })

            db.close()
        } catch (err) {
            console.warn('Failed to save vault to IndexedDB:', err)
        }
    }

    // Load all vault handles from IndexedDB
    async function loadVaultsFromIDB(): Promise<Array<{ id: string; handle: FileSystemDirectoryHandle; name: string }>> {
        try {
            const db = await openIDB()
            const tx = db.transaction(IDB_STORE, 'readonly')
            const store = tx.objectStore(IDB_STORE)

            const result = await new Promise<Array<{ id: string; handle: FileSystemDirectoryHandle; name: string }>>((resolve, reject) => {
                const request = store.getAll()
                request.onsuccess = () => resolve(request.result || [])
                request.onerror = () => reject(request.error)
            })

            db.close()
            return result
        } catch (err) {
            console.warn('Failed to load vaults from IndexedDB:', err)
            return []
        }
    }

    // Remove a vault from IndexedDB
    async function removeVaultFromIDB(id: string): Promise<void> {
        try {
            const db = await openIDB()
            const tx = db.transaction(IDB_STORE, 'readwrite')
            const store = tx.objectStore(IDB_STORE)

            await new Promise<void>((resolve, reject) => {
                const request = store.delete(id)
                request.onsuccess = () => resolve()
                request.onerror = () => reject(request.error)
            })

            db.close()
        } catch (err) {
            console.warn('Failed to remove vault from IndexedDB:', err)
        }
    }

    // Recursively read directory contents
    async function readDirectory(
        dirHandle: FileSystemDirectoryHandle,
        parentPath: string = ''
    ): Promise<(LocalFile | LocalDirectory)[]> {
        const items: (LocalFile | LocalDirectory)[] = []

        for await (const [name, handle] of dirHandle.entries()) {
            // Skip hidden files and folders (starting with .)
            if (name.startsWith('.')) continue

            const path = parentPath ? `${parentPath}/${name}` : name

            if (handle.kind === 'file') {
                const fileHandle = handle as FileSystemFileHandle
                // Only include markdown files
                if (name.endsWith('.md') || name.endsWith('.markdown')) {
                    const file = await fileHandle.getFile()
                    items.push({
                        handle: fileHandle,
                        name,
                        path,
                        kind: 'file',
                        lastModified: file.lastModified,
                        size: file.size
                    })
                }
            } else if (handle.kind === 'directory') {
                const subDirHandle = handle as FileSystemDirectoryHandle
                const children = await readDirectory(subDirHandle, path)

                // Only include directories that contain markdown files or subdirectories
                if (children.length > 0) {
                    items.push({
                        handle: subDirHandle,
                        name,
                        path,
                        kind: 'directory',
                        children,
                        expanded: false
                    })
                }
            }
        }

        // Sort: directories first, then files, both alphabetically
        items.sort((a, b) => {
            if (a.kind !== b.kind) {
                return a.kind === 'directory' ? -1 : 1
            }
            return a.name.localeCompare(b.name, undefined, { numeric: true })
        })

        return items
    }

    // Add a new vault (open directory picker)
    async function addVault(): Promise<VaultInfo | null> {
        if (!isSupported.value) {
            error.value = 'File System Access API is not supported in this browser. Please use Chrome, Edge, or Opera.'
            return null
        }

        try {
            isLoading.value = true
            error.value = null

            const handle = await window.showDirectoryPicker({
                mode: 'readwrite'
            })

            // Check if vault already exists
            const existing = vaults.value.find(v => v.name === handle.name)
            if (existing) {
                error.value = `Vault "${handle.name}" is already added.`
                return null
            }

            // Read directory contents
            const entries = await readDirectory(handle)

            const id = generateId()
            const newVault: VaultInfo = {
                id,
                handle,
                name: handle.name,
                path: handle.name,
                lastOpened: Date.now(),
                expanded: true,  // Expand by default when adding
                entries
            }

            // Update state
            vaults.value = [...vaults.value, newVault]
            mode.value = 'local-fs'

            // Persist handle for later sessions
            await saveVaultToIDB(id, handle, handle.name)

            return newVault
        } catch (err) {
            if ((err as Error).name === 'AbortError') {
                // User cancelled the picker
                return null
            }

            console.error('Failed to add vault:', err)
            error.value = `Failed to add vault: ${(err as Error).message}`
            return null
        } finally {
            isLoading.value = false
        }
    }

    // Remove a vault
    async function removeVault(vaultId: string): Promise<void> {
        const index = vaults.value.findIndex(v => v.id === vaultId)
        if (index === -1) return

        // Remove from state
        const newVaults = [...vaults.value]
        newVaults.splice(index, 1)
        vaults.value = newVaults

        // Remove from IndexedDB
        await removeVaultFromIDB(vaultId)

        // If no vaults left, switch to browser mode
        if (vaults.value.length === 0) {
            mode.value = 'browser'
        }
    }

    // Reconnect to all saved vaults on app startup
    async function reconnectVaults(): Promise<number> {
        if (!isSupported.value) return 0

        const savedVaults = await loadVaultsFromIDB()
        if (savedVaults.length === 0) return 0

        let connectedCount = 0

        for (const saved of savedVaults) {
            try {
                // Check if we still have permission
                const permission = await saved.handle.queryPermission({ mode: 'readwrite' })

                if (permission === 'granted') {
                    // We have permission, load the vault
                    const entries = await readDirectory(saved.handle)

                    const vault: VaultInfo = {
                        id: saved.id,
                        handle: saved.handle,
                        name: saved.name,
                        path: saved.name,
                        lastOpened: Date.now(),
                        expanded: false,  // Collapsed by default on reconnect
                        entries
                    }

                    vaults.value = [...vaults.value, vault]
                    connectedCount++
                }
                // If permission is 'prompt', user needs to grant it again via UI
            } catch (err) {
                console.warn(`Failed to reconnect vault "${saved.name}":`, err)
            }
        }

        if (connectedCount > 0) {
            mode.value = 'local-fs'
        }

        return connectedCount
    }

    // Request permission for a specific vault
    async function requestVaultPermission(vaultId: string): Promise<boolean> {
        const savedVaults = await loadVaultsFromIDB()
        const saved = savedVaults.find(v => v.id === vaultId)
        if (!saved) return false

        try {
            const permission = await saved.handle.requestPermission({ mode: 'readwrite' })

            if (permission === 'granted') {
                isLoading.value = true
                const entries = await readDirectory(saved.handle)

                const vault: VaultInfo = {
                    id: saved.id,
                    handle: saved.handle,
                    name: saved.name,
                    path: saved.name,
                    lastOpened: Date.now(),
                    expanded: true,
                    entries
                }

                vaults.value = [...vaults.value, vault]
                mode.value = 'local-fs'
                isLoading.value = false
                return true
            }

            return false
        } catch (err) {
            console.error('Failed to request vault permission:', err)
            return false
        }
    }

    // Toggle vault expansion state
    function toggleVaultExpanded(vaultId: string): void {
        const index = vaults.value.findIndex(v => v.id === vaultId)
        if (index === -1) return

        const newVaults = [...vaults.value]
        newVaults[index] = {
            ...newVaults[index],
            expanded: !newVaults[index].expanded
        }
        vaults.value = newVaults
    }

    // Toggle directory expansion within a vault
    function toggleDirectoryExpanded(vaultId: string, dirPath: string): void {
        const vaultIndex = vaults.value.findIndex(v => v.id === vaultId)
        if (vaultIndex === -1) return

        function toggleInEntries(entries: (LocalFile | LocalDirectory)[]): boolean {
            for (const entry of entries) {
                if (entry.kind === 'directory') {
                    if (entry.path === dirPath) {
                        entry.expanded = !entry.expanded
                        return true
                    }
                    if (toggleInEntries(entry.children)) return true
                }
            }
            return false
        }

        const vault = vaults.value[vaultIndex]
        toggleInEntries(vault.entries)
        // Trigger reactivity
        vaults.value = [...vaults.value]
    }

    // Refresh a specific vault's contents
    async function refreshVault(vaultId: string): Promise<boolean> {
        const index = vaults.value.findIndex(v => v.id === vaultId)
        if (index === -1) return false

        try {
            isLoading.value = true
            const vault = vaults.value[index]
            const entries = await readDirectory(vault.handle)

            const newVaults = [...vaults.value]
            newVaults[index] = { ...vault, entries }
            vaults.value = newVaults

            return true
        } catch (err) {
            console.error('Failed to refresh vault:', err)
            error.value = `Failed to refresh vault: ${(err as Error).message}`
            return false
        } finally {
            isLoading.value = false
        }
    }

    // Read a file's content
    async function readFile(handle: FileSystemFileHandle): Promise<string> {
        const file = await handle.getFile()
        return await file.text()
    }

    // Find a file entry by path (searches all vaults)
    function findFileByPath(filePath: string): LocalFile | null {
        function search(entries: (LocalFile | LocalDirectory)[]): LocalFile | null {
            for (const entry of entries) {
                if (entry.kind === 'file' && entry.path === filePath) {
                    return entry
                } else if (entry.kind === 'directory') {
                    const found = search(entry.children)
                    if (found) return found
                }
            }
            return null
        }

        for (const vault of vaults.value) {
            const found = search(vault.entries)
            if (found) return found
        }
        return null
    }

    // Find a file by path within a specific vault
    function findFileInVault(vaultId: string, filePath: string): LocalFile | null {
        const vault = vaults.value.find(v => v.id === vaultId)
        if (!vault) return null

        function search(entries: (LocalFile | LocalDirectory)[]): LocalFile | null {
            for (const entry of entries) {
                if (entry.kind === 'file' && entry.path === filePath) {
                    return entry
                } else if (entry.kind === 'directory') {
                    const found = search(entry.children)
                    if (found) return found
                }
            }
            return null
        }

        return search(vault.entries)
    }

    // Save content to a file
    async function saveFile(handle: FileSystemFileHandle, content: string): Promise<boolean> {
        try {
            const writable = await handle.createWritable()
            await writable.write(content)
            await writable.close()
            return true
        } catch (err) {
            console.error('Failed to save file:', err)
            error.value = `Failed to save file: ${(err as Error).message}`
            return false
        }
    }

    // Create a new file in a vault
    async function createFileInVault(
        vaultId: string,
        name: string,
        content: string = ''
    ): Promise<LocalFile | null> {
        const vault = vaults.value.find(v => v.id === vaultId)
        if (!vault) {
            error.value = 'Vault not found'
            return null
        }

        try {
            // Ensure .md extension
            const fileName = name.endsWith('.md') ? name : `${name}.md`

            const fileHandle = await vault.handle.getFileHandle(fileName, { create: true })

            if (content) {
                await saveFile(fileHandle, content)
            }

            const file = await fileHandle.getFile()
            const newFile: LocalFile = {
                handle: fileHandle,
                name: fileName,
                path: fileName,
                kind: 'file',
                lastModified: file.lastModified,
                size: file.size
            }

            // Add to vault entries
            const vaultIndex = vaults.value.findIndex(v => v.id === vaultId)
            if (vaultIndex !== -1) {
                const updatedVault = { ...vaults.value[vaultIndex] }
                updatedVault.entries = [...updatedVault.entries, newFile]
                // Sort entries
                updatedVault.entries.sort((a, b) => {
                    if (a.kind !== b.kind) {
                        return a.kind === 'directory' ? -1 : 1
                    }
                    return a.name.localeCompare(b.name, undefined, { numeric: true })
                })
                const newVaults = [...vaults.value]
                newVaults[vaultIndex] = updatedVault
                vaults.value = newVaults
            }

            return newFile
        } catch (err) {
            console.error('Failed to create file:', err)
            error.value = `Failed to create file: ${(err as Error).message}`
            return null
        }
    }

    // Set the current file handle for saving
    function setCurrentFile(handle: FileSystemFileHandle | null, path: string | null): void {
        currentFileHandle.value = handle
        currentFilePath.value = path
    }

    // Close all vaults and switch to browser mode
    function closeAllVaults(): void {
        vaults.value = []
        currentFileHandle.value = null
        currentFilePath.value = null
        mode.value = 'browser'
    }

    // Clear error
    function clearError(): void {
        error.value = null
    }

    // Get list of saved vault info for UI (even if not connected)
    async function getSavedVaultNames(): Promise<Array<{ id: string; name: string }>> {
        const saved = await loadVaultsFromIDB()
        return saved.map(v => ({ id: v.id, name: v.name }))
    }

    return {
        // State
        mode,
        vaults,
        currentFileHandle,
        currentFilePath,
        isLoading,
        error,
        isSupported,

        // Computed
        isLocalMode,
        hasVaults,
        allEntries,

        // Actions
        addVault,
        removeVault,
        reconnectVaults,
        requestVaultPermission,
        toggleVaultExpanded,
        toggleDirectoryExpanded,
        refreshVault,
        readFile,
        findFileByPath,
        findFileInVault,
        saveFile,
        createFileInVault,
        setCurrentFile,
        closeAllVaults,
        clearError,
        getSavedVaultNames
    }
})
