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
    const vaults = ref<VaultInfo[]>([])  // Use ref instead of shallowRef for deep reactivity
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

                // Include all directories, even empty ones
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

        // Deep clone function for entries to ensure reactivity
        function cloneEntries(entries: (LocalFile | LocalDirectory)[]): (LocalFile | LocalDirectory)[] {
            return entries.map(entry => {
                if (entry.kind === 'directory') {
                    return {
                        ...entry,
                        children: cloneEntries(entry.children),
                        expanded: entry.path === dirPath ? !entry.expanded : entry.expanded
                    }
                }
                return { ...entry }
            })
        }

        const vault = vaults.value[vaultIndex]
        const newVaults = [...vaults.value]
        newVaults[vaultIndex] = {
            ...vault,
            entries: cloneEntries(vault.entries)
        }
        vaults.value = newVaults
    }

    // Refresh a specific vault's contents
    // Helper to preserve directory expansion states during refresh
    function preserveExpansionState(
        oldEntries: (LocalFile | LocalDirectory)[],
        newEntries: (LocalFile | LocalDirectory)[]
    ): (LocalFile | LocalDirectory)[] {
        const expandedPaths = new Set<string>()

        // Collect expanded paths from old entries
        function collectExpanded(entries: (LocalFile | LocalDirectory)[]) {
            for (const entry of entries) {
                if (entry.kind === 'directory') {
                    if (entry.expanded) {
                        expandedPaths.add(entry.path)
                    }
                    collectExpanded(entry.children)
                }
            }
        }
        collectExpanded(oldEntries)

        // Apply expanded state to new entries
        function applyExpanded(entries: (LocalFile | LocalDirectory)[]): (LocalFile | LocalDirectory)[] {
            return entries.map(entry => {
                if (entry.kind === 'directory') {
                    const isExpanded = expandedPaths.has(entry.path)
                    // Recursively apply to children
                    const children = applyExpanded(entry.children)
                    return {
                        ...entry,
                        expanded: isExpanded,
                        children
                    }
                }
                return entry
            })
        }

        return applyExpanded(newEntries)
    }

    // Refresh a specific vault's contents
    async function refreshVault(vaultId: string): Promise<boolean> {
        const index = vaults.value.findIndex(v => v.id === vaultId)
        if (index === -1) return false

        try {
            isLoading.value = true
            const vault = vaults.value[index]
            const rawEntries = await readDirectory(vault.handle)

            // Preserve expansion states
            const entries = preserveExpansionState(vault.entries, rawEntries)

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

    // Rename a file in a vault
    async function renameFileInVault(
        vaultId: string,
        filePath: string,
        newName: string
    ): Promise<LocalFile | null> {
        const vault = vaults.value.find(v => v.id === vaultId)
        if (!vault) {
            error.value = 'Vault not found'
            return null
        }

        try {
            // Find the file
            const file = findFileInVault(vaultId, filePath)
            if (!file) {
                error.value = 'File not found'
                return null
            }

            // Ensure .md extension
            const newFileName = newName.endsWith('.md') ? newName : `${newName}.md`
            if (newFileName === file.name) return file

            // Read current content
            const content = await readFile(file.handle)

            // Get parent directory handle
            const parentPath = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : ''
            const parentHandle = parentPath ? await getDirectoryHandle(vault.handle, parentPath) : vault.handle

            if (!parentHandle) {
                error.value = 'Parent directory not found'
                return null
            }

            // Check if target already exists to prevent overwrite
            try {
                // If this succeeds, the file exists
                await parentHandle.getFileHandle(newFileName)
                error.value = 'File with this name already exists'
                return null
            } catch (e) {
                // File does not exist, safe to proceed
            }

            // Create new file with new name
            const newFileHandle = await parentHandle.getFileHandle(newFileName, { create: true })
            await saveFile(newFileHandle, content)

            // Delete old file
            await parentHandle.removeEntry(file.name)

            // Refresh vault to update UI
            await refreshVault(vaultId)

            // Find and return the new file
            const newPath = parentPath ? `${parentPath}/${newFileName}` : newFileName
            return findFileInVault(vaultId, newPath)
        } catch (err) {
            console.error('Failed to rename file:', err)
            error.value = `Failed to rename file: ${(err as Error).message}`
            return null
        }
    }

    // Rename a directory in a vault
    async function renameDirectoryInVault(
        vaultId: string,
        dirPath: string,
        newName: string
    ): Promise<boolean> {
        const vault = vaults.value.find(v => v.id === vaultId)
        if (!vault) {
            error.value = 'Vault not found'
            return false
        }

        try {
            // Get parent path and old name
            const parentPath = dirPath.includes('/') ? dirPath.substring(0, dirPath.lastIndexOf('/')) : ''
            const oldName = dirPath.includes('/') ? dirPath.substring(dirPath.lastIndexOf('/') + 1) : dirPath
            const parentHandle = parentPath ? await getDirectoryHandle(vault.handle, parentPath) : vault.handle

            if (!parentHandle) {
                error.value = 'Parent directory not found'
                return false
            }

            // Get source directory handle
            const sourceDir = await parentHandle.getDirectoryHandle(oldName)

            // Create new directory
            const newDir = await parentHandle.getDirectoryHandle(newName, { create: true })

            // Copy all contents recursively
            await copyDirectoryContents(sourceDir, newDir)

            // Remove old directory
            await parentHandle.removeEntry(oldName, { recursive: true })

            // Refresh vault to update UI
            await refreshVault(vaultId)

            return true
        } catch (err) {
            console.error('Failed to rename directory:', err)
            error.value = `Failed to rename directory: ${(err as Error).message}`
            return false
        }
    }

    // Delete a file from a vault
    async function deleteFileInVault(vaultId: string, filePath: string): Promise<boolean> {
        const vault = vaults.value.find(v => v.id === vaultId)
        if (!vault) {
            error.value = 'Vault not found'
            return false
        }

        try {
            const file = findFileInVault(vaultId, filePath)
            if (!file) {
                error.value = 'File not found'
                return false
            }

            // Get parent directory handle
            const parentPath = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : ''
            const parentHandle = parentPath ? await getDirectoryHandle(vault.handle, parentPath) : vault.handle

            if (!parentHandle) {
                error.value = 'Parent directory not found'
                return false
            }

            // Delete the file
            await parentHandle.removeEntry(file.name)

            // Refresh vault to update UI
            await refreshVault(vaultId)

            return true
        } catch (err) {
            console.error('Failed to delete file:', err)
            error.value = `Failed to delete file: ${(err as Error).message}`
            return false
        }
    }

    // Delete a directory from a vault
    async function deleteDirectoryInVault(vaultId: string, dirPath: string): Promise<boolean> {
        const vault = vaults.value.find(v => v.id === vaultId)
        if (!vault) {
            error.value = 'Vault not found'
            return false
        }

        try {
            // Get parent path and directory name
            const parentPath = dirPath.includes('/') ? dirPath.substring(0, dirPath.lastIndexOf('/')) : ''
            const dirName = dirPath.includes('/') ? dirPath.substring(dirPath.lastIndexOf('/') + 1) : dirPath
            const parentHandle = parentPath ? await getDirectoryHandle(vault.handle, parentPath) : vault.handle

            if (!parentHandle) {
                error.value = 'Parent directory not found'
                return false
            }

            // Delete the directory recursively
            await parentHandle.removeEntry(dirName, { recursive: true })

            // Refresh vault to update UI
            await refreshVault(vaultId)

            return true
        } catch (err) {
            console.error('Failed to delete directory:', err)
            error.value = `Failed to delete directory: ${(err as Error).message}`
            return false
        }
    }

    // Create a new directory in a vault
    async function createDirectoryInVault(
        vaultId: string,
        parentPath: string,
        name: string
    ): Promise<boolean> {
        const vault = vaults.value.find(v => v.id === vaultId)
        if (!vault) {
            error.value = 'Vault not found'
            return false
        }

        try {
            const parentHandle = parentPath ? await getDirectoryHandle(vault.handle, parentPath) : vault.handle

            if (!parentHandle) {
                error.value = 'Parent directory not found'
                return false
            }

            // Create the new directory
            await parentHandle.getDirectoryHandle(name, { create: true })

            // Refresh vault to update UI
            await refreshVault(vaultId)

            return true
        } catch (err) {
            console.error('Failed to create directory:', err)
            error.value = `Failed to create directory: ${(err as Error).message}`
            return false
        }
    }

    // Create a new file in a specific directory within a vault
    async function createFileInDirectory(
        vaultId: string,
        parentPath: string,
        name: string,
        content: string = ''
    ): Promise<LocalFile | null> {
        const vault = vaults.value.find(v => v.id === vaultId)
        if (!vault) {
            error.value = 'Vault not found'
            return null
        }

        try {
            const parentHandle = parentPath ? await getDirectoryHandle(vault.handle, parentPath) : vault.handle

            if (!parentHandle) {
                error.value = 'Parent directory not found'
                return null
            }

            // Ensure .md extension
            const fileName = name.endsWith('.md') ? name : `${name}.md`

            const fileHandle = await parentHandle.getFileHandle(fileName, { create: true })

            if (content) {
                await saveFile(fileHandle, content)
            }

            // Refresh vault to update UI
            await refreshVault(vaultId)

            const newPath = parentPath ? `${parentPath}/${fileName}` : fileName
            return findFileInVault(vaultId, newPath)
        } catch (err) {
            console.error('Failed to create file:', err)
            error.value = `Failed to create file: ${(err as Error).message}`
            return null
        }
    }

    // Move a file to a new location
    async function moveFileInVault(
        vaultId: string,
        sourcePath: string,
        targetPath: string
    ): Promise<boolean> {
        const vault = vaults.value.find(v => v.id === vaultId)
        if (!vault) {
            error.value = 'Vault not found'
            return false
        }

        try {
            const file = findFileInVault(vaultId, sourcePath)
            if (!file) {
                error.value = 'Source file not found'
                return false
            }

            // Read content
            const content = await readFile(file.handle)

            // Get source parent handle
            const sourceParentPath = sourcePath.includes('/') ? sourcePath.substring(0, sourcePath.lastIndexOf('/')) : ''
            const sourceParentHandle = sourceParentPath ? await getDirectoryHandle(vault.handle, sourceParentPath) : vault.handle

            // Get target parent handle
            const targetParentHandle = targetPath ? await getDirectoryHandle(vault.handle, targetPath) : vault.handle

            if (!sourceParentHandle || !targetParentHandle) {
                error.value = 'Directory not found'
                return false
            }

            // Create file in new location
            const newFileHandle = await targetParentHandle.getFileHandle(file.name, { create: true })
            await saveFile(newFileHandle, content)

            // Delete from old location
            await sourceParentHandle.removeEntry(file.name)

            // Refresh vault to update UI
            await refreshVault(vaultId)

            return true
        } catch (err) {
            console.error('Failed to move file:', err)
            error.value = `Failed to move file: ${(err as Error).message}`
            return false
        }
    }

    // Move a directory to a new location
    async function moveDirectoryInVault(
        vaultId: string,
        sourcePath: string,
        targetPath: string
    ): Promise<boolean> {
        const vault = vaults.value.find(v => v.id === vaultId)
        if (!vault) {
            error.value = 'Vault not found'
            return false
        }

        try {
            // Get source info
            const sourceParentPath = sourcePath.includes('/') ? sourcePath.substring(0, sourcePath.lastIndexOf('/')) : ''
            const sourceName = sourcePath.includes('/') ? sourcePath.substring(sourcePath.lastIndexOf('/') + 1) : sourcePath
            const sourceParentHandle = sourceParentPath ? await getDirectoryHandle(vault.handle, sourceParentPath) : vault.handle

            if (!sourceParentHandle) {
                error.value = 'Source directory not found'
                return false
            }

            // Get source directory
            const sourceDir = await sourceParentHandle.getDirectoryHandle(sourceName)

            // Get target parent handle
            const targetParentHandle = targetPath ? await getDirectoryHandle(vault.handle, targetPath) : vault.handle

            if (!targetParentHandle) {
                error.value = 'Target directory not found'
                return false
            }

            // Create new directory in target
            const newDir = await targetParentHandle.getDirectoryHandle(sourceName, { create: true })

            // Copy contents
            await copyDirectoryContents(sourceDir, newDir)

            // Remove source
            await sourceParentHandle.removeEntry(sourceName, { recursive: true })

            // Refresh vault to update UI
            await refreshVault(vaultId)

            return true
        } catch (err) {
            console.error('Failed to move directory:', err)
            error.value = `Failed to move directory: ${(err as Error).message}`
            return false
        }
    }

    // Helper: Get a directory handle by path
    async function getDirectoryHandle(
        rootHandle: FileSystemDirectoryHandle,
        path: string
    ): Promise<FileSystemDirectoryHandle | null> {
        if (!path) return rootHandle

        const parts = path.split('/')
        let current = rootHandle

        for (const part of parts) {
            try {
                current = await current.getDirectoryHandle(part)
            } catch {
                return null
            }
        }

        return current
    }

    // Helper: Copy directory contents recursively
    async function copyDirectoryContents(
        source: FileSystemDirectoryHandle,
        target: FileSystemDirectoryHandle
    ): Promise<void> {
        for await (const [name, handle] of source.entries()) {
            if (handle.kind === 'file') {
                const fileHandle = handle as FileSystemFileHandle
                const file = await fileHandle.getFile()
                const content = await file.text()
                const newFileHandle = await target.getFileHandle(name, { create: true })
                const writable = await newFileHandle.createWritable()
                await writable.write(content)
                await writable.close()
            } else {
                const subDir = handle as FileSystemDirectoryHandle
                const newSubDir = await target.getDirectoryHandle(name, { create: true })
                await copyDirectoryContents(subDir, newSubDir)
            }
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
        createFileInDirectory,
        createDirectoryInVault,
        renameFileInVault,
        renameDirectoryInVault,
        deleteFileInVault,
        deleteDirectoryInVault,
        moveFileInVault,
        moveDirectoryInVault,
        setCurrentFile,
        closeAllVaults,
        clearError,
        getSavedVaultNames
    }
})
