/**
 * File System Access API types for Obsidian integration
 * Provides type-safe interfaces for local file system operations
 */

// Basic file system entry representing a file or directory
export interface FileSystemEntry {
    handle: FileSystemFileHandle | FileSystemDirectoryHandle
    name: string
    path: string
    kind: 'file' | 'directory'
}

// Extended file entry with content and metadata
export interface LocalFile extends FileSystemEntry {
    kind: 'file'
    handle: FileSystemFileHandle
    content?: string
    lastModified?: number
    size?: number
}

// Directory entry with children
export interface LocalDirectory extends FileSystemEntry {
    kind: 'directory'
    handle: FileSystemDirectoryHandle
    children: (LocalFile | LocalDirectory)[]
    expanded: boolean
}

// Root vault information
export interface VaultInfo {
    id: string  // Unique identifier for the vault
    handle: FileSystemDirectoryHandle
    name: string
    path: string
    lastOpened: number
    expanded: boolean  // UI state: whether the vault is expanded in sidebar
    entries: (LocalFile | LocalDirectory)[]  // Files and folders in this vault
}

// Storage mode for the application
export type StorageMode = 'browser' | 'local-fs'

// File system store state (updated for multi-vault)
export interface FileSystemState {
    mode: StorageMode
    vaults: VaultInfo[]  // Support multiple vaults
    activeVaultId: string | null  // Currently selected vault
    currentFileHandle: FileSystemFileHandle | null
    currentFilePath: string | null
    isLoading: boolean
    error: string | null
}

// Saved file handle for persistence (used with IndexedDB)
export interface SavedHandleInfo {
    name: string
    path: string
    lastOpened: number
}

// Type guard to check if File System Access API is supported
export function isFileSystemAccessSupported(): boolean {
    return 'showDirectoryPicker' in window
}

// Type guard for LocalFile
export function isLocalFile(entry: LocalFile | LocalDirectory): entry is LocalFile {
    return entry.kind === 'file'
}

// Type guard for LocalDirectory
export function isLocalDirectory(entry: LocalFile | LocalDirectory): entry is LocalDirectory {
    return entry.kind === 'directory'
}

// Extend Window interface to include File System Access API picker methods
// Note: The FileSystemHandle, FileSystemFileHandle, FileSystemDirectoryHandle types
// are already defined in TypeScript's lib.dom.d.ts for modern browsers
// We extend them here to add methods that may not be in all TypeScript versions
declare global {
    interface Window {
        showDirectoryPicker(options?: {
            id?: string
            mode?: 'read' | 'readwrite'
            startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'
        }): Promise<FileSystemDirectoryHandle>
        showOpenFilePicker(options?: {
            multiple?: boolean
            excludeAcceptAllOption?: boolean
            types?: Array<{
                description?: string
                accept: Record<string, string[]>
            }>
            startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'
        }): Promise<FileSystemFileHandle[]>
        showSaveFilePicker(options?: {
            excludeAcceptAllOption?: boolean
            suggestedName?: string
            types?: Array<{
                description?: string
                accept: Record<string, string[]>
            }>
            startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'
        }): Promise<FileSystemFileHandle>
    }

    // Extend FileSystemHandle to include permission methods
    interface FileSystemHandle {
        queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
        requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
    }

    // Extend FileSystemDirectoryHandle to include entries() method
    interface FileSystemDirectoryHandle {
        entries(): AsyncIterableIterator<[string, FileSystemHandle]>
        keys(): AsyncIterableIterator<string>
        values(): AsyncIterableIterator<FileSystemHandle>
    }
}

export { }

