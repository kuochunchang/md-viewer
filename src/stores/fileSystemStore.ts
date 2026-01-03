/**
 * File System Store - Manages local file system state for Obsidian integration
 * Handles vault opening, file reading/writing, and mode switching
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
const IDB_STORE = 'handles'

export const useFileSystemStore = defineStore('fileSystem', () => {
    // State
    const mode = ref<StorageMode>('browser')
    const vault = shallowRef<VaultInfo | null>(null)
    const entries = ref<(LocalFile | LocalDirectory)[]>([])
    const currentFileHandle = shallowRef<FileSystemFileHandle | null>(null)
    const currentFilePath = ref<string | null>(null)
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const isSupported = ref(isFileSystemAccessSupported())

    // Computed
    const isLocalMode = computed(() => mode.value === 'local-fs')
    const hasVault = computed(() => vault.value !== null)
    const vaultName = computed(() => vault.value?.name || '')

    // Get all markdown files recursively from entries
    const allMarkdownFiles = computed(() => {
        const files: LocalFile[] = []

        function traverse(items: (LocalFile | LocalDirectory)[]) {
            for (const item of items) {
                if (item.kind === 'file') {
                    if (item.name.endsWith('.md') || item.name.endsWith('.markdown')) {
                        files.push(item)
                    }
                } else if (item.kind === 'directory') {
                    traverse(item.children)
                }
            }
        }

        traverse(entries.value)
        return files
    })

    // IndexedDB helpers for persisting directory handle
    async function openIDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(IDB_NAME, 1)

            request.onerror = () => reject(request.error)
            request.onsuccess = () => resolve(request.result)

            request.onupgradeneeded = () => {
                const db = request.result
                if (!db.objectStoreNames.contains(IDB_STORE)) {
                    db.createObjectStore(IDB_STORE)
                }
            }
        })
    }

    async function saveHandleToIDB(handle: FileSystemDirectoryHandle): Promise<void> {
        try {
            const db = await openIDB()
            const tx = db.transaction(IDB_STORE, 'readwrite')
            const store = tx.objectStore(IDB_STORE)

            await new Promise<void>((resolve, reject) => {
                const request = store.put(handle, 'vaultHandle')
                request.onsuccess = () => resolve()
                request.onerror = () => reject(request.error)
            })

            db.close()
        } catch (err) {
            console.warn('Failed to save handle to IndexedDB:', err)
        }
    }

    async function loadHandleFromIDB(): Promise<FileSystemDirectoryHandle | null> {
        try {
            const db = await openIDB()
            const tx = db.transaction(IDB_STORE, 'readonly')
            const store = tx.objectStore(IDB_STORE)

            const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
                const request = store.get('vaultHandle')
                request.onsuccess = () => resolve(request.result || null)
                request.onerror = () => reject(request.error)
            })

            db.close()
            return handle
        } catch (err) {
            console.warn('Failed to load handle from IndexedDB:', err)
            return null
        }
    }

    async function clearHandleFromIDB(): Promise<void> {
        try {
            const db = await openIDB()
            const tx = db.transaction(IDB_STORE, 'readwrite')
            const store = tx.objectStore(IDB_STORE)

            await new Promise<void>((resolve, reject) => {
                const request = store.delete('vaultHandle')
                request.onsuccess = () => resolve()
                request.onerror = () => reject(request.error)
            })

            db.close()
        } catch (err) {
            console.warn('Failed to clear handle from IndexedDB:', err)
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

    // Open a local vault (directory)
    async function openVault(): Promise<boolean> {
        if (!isSupported.value) {
            error.value = 'File System Access API is not supported in this browser. Please use Chrome, Edge, or Opera.'
            return false
        }

        try {
            isLoading.value = true
            error.value = null

            const handle = await window.showDirectoryPicker({
                mode: 'readwrite'
            })

            // Read directory contents
            const contents = await readDirectory(handle)

            // Update state
            vault.value = {
                handle,
                name: handle.name,
                path: handle.name,
                lastOpened: Date.now()
            }
            entries.value = contents
            mode.value = 'local-fs'

            // Persist handle for later sessions
            await saveHandleToIDB(handle)

            return true
        } catch (err) {
            if ((err as Error).name === 'AbortError') {
                // User cancelled the picker
                return false
            }

            console.error('Failed to open vault:', err)
            error.value = `Failed to open vault: ${(err as Error).message}`
            return false
        } finally {
            isLoading.value = false
        }
    }

    // Try to reconnect to a previously opened vault
    async function reconnectVault(): Promise<boolean> {
        if (!isSupported.value) return false

        try {
            const handle = await loadHandleFromIDB()
            if (!handle) return false

            // Check if we still have permission
            const permission = await handle.queryPermission({ mode: 'readwrite' })

            if (permission === 'granted') {
                // We have permission, reload the vault
                isLoading.value = true
                const contents = await readDirectory(handle)

                vault.value = {
                    handle,
                    name: handle.name,
                    path: handle.name,
                    lastOpened: Date.now()
                }
                entries.value = contents
                mode.value = 'local-fs'
                isLoading.value = false
                return true
            } else if (permission === 'prompt') {
                // Need to request permission again (will be done on user gesture)
                return false
            }

            return false
        } catch (err) {
            console.warn('Failed to reconnect vault:', err)
            return false
        }
    }

    // Request permission for a previously used vault
    async function requestVaultPermission(): Promise<boolean> {
        if (!isSupported.value) return false

        try {
            const handle = await loadHandleFromIDB()
            if (!handle) return false

            const permission = await handle.requestPermission({ mode: 'readwrite' })

            if (permission === 'granted') {
                isLoading.value = true
                const contents = await readDirectory(handle)

                vault.value = {
                    handle,
                    name: handle.name,
                    path: handle.name,
                    lastOpened: Date.now()
                }
                entries.value = contents
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

    // Close the current vault
    function closeVault(): void {
        vault.value = null
        entries.value = []
        currentFileHandle.value = null
        currentFilePath.value = null
        mode.value = 'browser'
    }

    // Clear saved vault from IndexedDB and close
    async function forgetVault(): Promise<void> {
        await clearHandleFromIDB()
        closeVault()
    }

    // Read a file's content
    async function readFile(handle: FileSystemFileHandle): Promise<string> {
        const file = await handle.getFile()
        return await file.text()
    }

    // Read a file by path
    async function readFileByPath(path: string): Promise<string | null> {
        const file = findFileByPath(path)
        if (!file) return null

        currentFileHandle.value = file.handle
        currentFilePath.value = path
        return await readFile(file.handle)
    }

    // Find a file entry by path
    function findFileByPath(path: string): LocalFile | null {
        function search(items: (LocalFile | LocalDirectory)[]): LocalFile | null {
            for (const item of items) {
                if (item.kind === 'file' && item.path === path) {
                    return item
                } else if (item.kind === 'directory') {
                    const found = search(item.children)
                    if (found) return found
                }
            }
            return null
        }

        return search(entries.value)
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

    // Save content to the current file
    async function saveCurrentFile(content: string): Promise<boolean> {
        if (!currentFileHandle.value) {
            error.value = 'No file is currently open'
            return false
        }

        return await saveFile(currentFileHandle.value, content)
    }

    // Save content to a file by path
    async function saveFileByPath(path: string, content: string): Promise<boolean> {
        const file = findFileByPath(path)
        if (!file) {
            error.value = `File not found: ${path}`
            return false
        }

        return await saveFile(file.handle, content)
    }

    // Create a new file in a directory
    async function createFile(
        dirHandle: FileSystemDirectoryHandle,
        name: string,
        content: string = ''
    ): Promise<FileSystemFileHandle | null> {
        try {
            // Ensure .md extension
            const fileName = name.endsWith('.md') ? name : `${name}.md`

            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true })

            if (content) {
                await saveFile(fileHandle, content)
            }

            return fileHandle
        } catch (err) {
            console.error('Failed to create file:', err)
            error.value = `Failed to create file: ${(err as Error).message}`
            return null
        }
    }

    // Create a new file in the vault root
    async function createFileInRoot(name: string, content: string = ''): Promise<LocalFile | null> {
        if (!vault.value) {
            error.value = 'No vault is open'
            return null
        }

        const fileHandle = await createFile(vault.value.handle, name, content)
        if (!fileHandle) return null

        const fileName = name.endsWith('.md') ? name : `${name}.md`
        const file = await fileHandle.getFile()

        const newFile: LocalFile = {
            handle: fileHandle,
            name: fileName,
            path: fileName,
            kind: 'file',
            lastModified: file.lastModified,
            size: file.size
        }

        // Add to entries
        entries.value = [...entries.value, newFile]

        // Re-sort entries
        entries.value.sort((a, b) => {
            if (a.kind !== b.kind) {
                return a.kind === 'directory' ? -1 : 1
            }
            return a.name.localeCompare(b.name, undefined, { numeric: true })
        })

        return newFile
    }

    // Set the current file handle for saving
    function setCurrentFile(handle: FileSystemFileHandle | null, path: string | null): void {
        currentFileHandle.value = handle
        currentFilePath.value = path
    }

    // Toggle directory expansion
    function toggleDirectoryExpanded(path: string): void {
        function toggle(items: (LocalFile | LocalDirectory)[]): boolean {
            for (const item of items) {
                if (item.kind === 'directory') {
                    if (item.path === path) {
                        item.expanded = !item.expanded
                        return true
                    }
                    if (toggle(item.children)) return true
                }
            }
            return false
        }

        toggle(entries.value)
    }

    // Refresh the vault contents
    async function refreshVault(): Promise<boolean> {
        if (!vault.value) return false

        try {
            isLoading.value = true
            const contents = await readDirectory(vault.value.handle)
            entries.value = contents
            return true
        } catch (err) {
            console.error('Failed to refresh vault:', err)
            error.value = `Failed to refresh vault: ${(err as Error).message}`
            return false
        } finally {
            isLoading.value = false
        }
    }

    // Clear error
    function clearError(): void {
        error.value = null
    }

    return {
        // State
        mode,
        vault,
        entries,
        currentFileHandle,
        currentFilePath,
        isLoading,
        error,
        isSupported,

        // Computed
        isLocalMode,
        hasVault,
        vaultName,
        allMarkdownFiles,

        // Actions
        openVault,
        reconnectVault,
        requestVaultPermission,
        closeVault,
        forgetVault,
        readFile,
        readFileByPath,
        findFileByPath,
        saveFile,
        saveCurrentFile,
        saveFileByPath,
        createFile,
        createFileInRoot,
        setCurrentFile,
        toggleDirectoryExpanded,
        refreshVault,
        clearError
    }
})
