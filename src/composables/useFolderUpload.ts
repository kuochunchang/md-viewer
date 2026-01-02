import { useTabsStore } from '../stores/tabsStore'

export function useFolderUpload() {
    const tabsStore = useTabsStore()

    /**
     * Read file content as text
     */
    function readFileContent(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = () => reject(reader.error)
            reader.readAsText(file)
        })
    }

    /**
     * Check if file is a markdown file
     */
    function isMarkdownFile(filename: string): boolean {
        const ext = filename.toLowerCase().split('.').pop()
        return ext === 'md' || ext === 'markdown'
    }

    /**
     * Process uploaded folder and add to the file system
     */
    async function processFiles(files: FileList): Promise<{ folders: number; files: number }> {
        // Build folder structure map: path -> folderId
        const folderIdMap = new Map<string, string>()
        let folderCount = 0
        let fileCount = 0

        // First pass: collect all unique folder paths from all files
        const folderPaths = new Set<string>()

        for (const file of Array.from(files)) {
            if (!isMarkdownFile(file.name)) continue

            const relativePath = file.webkitRelativePath
            const pathParts = relativePath.split('/')

            // Collect all parent folder paths
            for (let i = 1; i < pathParts.length; i++) {
                const folderPath = pathParts.slice(0, i).join('/')
                folderPaths.add(folderPath)
            }
        }

        // Sort folder paths by depth to create parents first
        const sortedFolderPaths = Array.from(folderPaths).sort((a, b) => {
            return a.split('/').length - b.split('/').length
        })

        // Create folders in order
        for (const folderPath of sortedFolderPaths) {
            const pathParts = folderPath.split('/')
            const folderName = pathParts[pathParts.length - 1]

            // Find parent folder ID
            let parentId: string | null = null
            if (pathParts.length > 1) {
                const parentPath = pathParts.slice(0, -1).join('/')
                parentId = folderIdMap.get(parentPath) || null
            }

            // Create folder
            const folderId = tabsStore.addFolder(folderName, parentId)
            folderIdMap.set(folderPath, folderId)
            folderCount++
        }

        // Second pass: create files with content
        for (const file of Array.from(files)) {
            if (!isMarkdownFile(file.name)) continue

            const relativePath = file.webkitRelativePath
            const pathParts = relativePath.split('/')

            // Find parent folder ID
            let folderId: string | null = null
            if (pathParts.length > 1) {
                const parentPath = pathParts.slice(0, -1).join('/')
                folderId = folderIdMap.get(parentPath) || null
            }

            // Read file content
            const content = await readFileContent(file)

            // Create tab with content
            tabsStore.addTabWithContent(file.name, content, folderId)
            fileCount++
        }

        return { folders: folderCount, files: fileCount }
    }

    /**
     * Open folder picker dialog and process selected folder
     */
    function uploadFolder(): Promise<{ folders: number; files: number }> {
        return new Promise((resolve, reject) => {
            // Create hidden input element
            const input = document.createElement('input')
            input.type = 'file'
            input.setAttribute('webkitdirectory', '')
            input.setAttribute('directory', '')
            input.multiple = true
            input.style.display = 'none'

            input.onchange = async () => {
                if (!input.files || input.files.length === 0) {
                    resolve({ folders: 0, files: 0 })
                    return
                }

                try {
                    const result = await processFiles(input.files)
                    resolve(result)
                } catch (error) {
                    reject(error)
                } finally {
                    document.body.removeChild(input)
                }
            }

            input.oncancel = () => {
                resolve({ folders: 0, files: 0 })
                document.body.removeChild(input)
            }

            document.body.appendChild(input)
            input.click()
        })
    }

    return {
        uploadFolder,
        isMarkdownFile
    }
}
