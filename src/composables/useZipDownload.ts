/**
 * ZIP download functionality
 * Downloads all documents and folders as a ZIP file maintaining the folder structure
 */

import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { ref } from 'vue'
import { useTabsStore } from '../stores/tabsStore'
import type { Tab, Folder } from '../types'

export function useZipDownload() {
    const isDownloading = ref(false)
    const downloadError = ref<string | null>(null)

    /**
     * Build a map of folder ID to folder path
     */
    function buildFolderPaths(folders: Folder[]): Map<string, string> {
        const pathMap = new Map<string, string>()

        // Build parent-child relationships
        const childrenMap = new Map<string | null, Folder[]>()
        folders.forEach(folder => {
            const parentId = folder.parentId
            if (!childrenMap.has(parentId)) {
                childrenMap.set(parentId, [])
            }
            childrenMap.get(parentId)!.push(folder)
        })

        // Recursively build paths starting from root folders
        function buildPath(folderId: string, basePath: string) {
            const folder = folders.find(f => f.id === folderId)
            if (!folder) return

            const folderPath = basePath ? `${basePath}/${sanitizeFileName(folder.name)}` : sanitizeFileName(folder.name)
            pathMap.set(folderId, folderPath)

            // Process children
            const children = childrenMap.get(folderId) || []
            children.forEach(child => {
                buildPath(child.id, folderPath)
            })
        }

        // Start from root folders
        const rootFolders = childrenMap.get(null) || []
        rootFolders.forEach(folder => {
            buildPath(folder.id, '')
        })

        return pathMap
    }

    /**
     * Sanitize file/folder name to be safe for file systems
     */
    function sanitizeFileName(name: string): string {
        // Remove or replace characters that are problematic in file systems
        return name
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, ' ')
            .trim() || 'untitled'
    }

    /**
     * Ensure unique file names within the same folder
     */
    function ensureUniqueFileName(
        existingNames: Set<string>,
        baseName: string,
        extension: string
    ): string {
        let fileName = `${baseName}${extension}`
        let counter = 1

        while (existingNames.has(fileName)) {
            fileName = `${baseName}_${counter}${extension}`
            counter++
        }

        existingNames.add(fileName)
        return fileName
    }

    /**
     * Download all documents as a ZIP file
     */
    async function downloadAsZip(rootFolderName?: string): Promise<void> {
        const tabsStore = useTabsStore()

        isDownloading.value = true
        downloadError.value = null

        try {
            const zip = new JSZip()
            const folders = tabsStore.folders
            const tabs = tabsStore.tabs

            // Determine root folder name
            const zipRootName = sanitizeFileName(rootFolderName || 'md-documents')

            // Build folder paths
            const folderPaths = buildFolderPaths(folders)

            // Track file names per folder to ensure uniqueness
            const fileNamesByFolder = new Map<string, Set<string>>()

            // Add files to zip
            tabs.forEach((tab: Tab) => {
                const folderKey = tab.folderId || '__root__'

                if (!fileNamesByFolder.has(folderKey)) {
                    fileNamesByFolder.set(folderKey, new Set())
                }
                const existingNames = fileNamesByFolder.get(folderKey)!

                // Get the file name with .md extension
                const baseName = sanitizeFileName(tab.name.replace(/\.md$/i, ''))
                const fileName = ensureUniqueFileName(existingNames, baseName, '.md')

                // Determine the full path
                let fullPath: string
                if (tab.folderId && folderPaths.has(tab.folderId)) {
                    fullPath = `${zipRootName}/${folderPaths.get(tab.folderId)}/${fileName}`
                } else {
                    fullPath = `${zipRootName}/${fileName}`
                }

                // Add file to zip
                zip.file(fullPath, tab.content || '')
            })

            // Add empty folders (folders without any files)
            folders.forEach((folder: Folder) => {
                const folderPath = folderPaths.get(folder.id)
                if (folderPath) {
                    const fullPath = `${zipRootName}/${folderPath}/`
                    // JSZip creates folders automatically when adding files,
                    // but we need to explicitly add empty folders
                    const hasFiles = tabs.some(tab => tab.folderId === folder.id)
                    const hasSubfolders = folders.some(f => f.parentId === folder.id)

                    if (!hasFiles && !hasSubfolders) {
                        // Create empty folder by adding a path ending with /
                        zip.folder(fullPath)
                    }
                }
            })

            // Generate the zip file
            const blob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            })

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().slice(0, 10)
            const zipFileName = `${zipRootName}_${timestamp}.zip`

            // Trigger download
            saveAs(blob, zipFileName)

        } catch (error) {
            console.error('Failed to create zip:', error)
            downloadError.value = error instanceof Error ? error.message : 'Failed to create zip file'
            throw error
        } finally {
            isDownloading.value = false
        }
    }

    return {
        isDownloading,
        downloadError,
        downloadAsZip
    }
}
