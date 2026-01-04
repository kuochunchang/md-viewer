/**
 * File System Adapter for isomorphic-git
 * 
 * This adapter converts File System Access API (browser) to the fs interface
 * that isomorphic-git expects (Node.js-style).
 * 
 * Based on: https://isomorphic-git.org/docs/en/fs
 */

type EncodingType = 'utf8' | undefined

interface StatResult {
    type: 'file' | 'dir'
    mode: number
    size: number
    ino: number
    mtimeMs: number
    ctimeMs: number
    uid: number
    gid: number
    dev: number
    isFile: () => boolean
    isDirectory: () => boolean
    isSymbolicLink: () => boolean
}

/**
 * Create an ENOENT error that isomorphic-git can recognize
 * isomorphic-git checks for error.code === 'ENOENT'
 */
function createENOENT(filepath: string): Error & { code: string } {
    const err = new Error(`ENOENT: no such file or directory, '${filepath}'`) as Error & { code: string }
    err.code = 'ENOENT'
    return err
}

/**
 * Create a file system adapter for isomorphic-git from a FileSystemDirectoryHandle
 */
export function createFsAdapter(rootHandle: FileSystemDirectoryHandle) {
    /**
     * Split a path into parts, handling both forward and back slashes
     * Filters out empty segments and standalone '.' (current dir), but keeps dotfiles like '.git'
     */
    function splitPath(filepath: string): string[] {
        return filepath.split(/[/\\]/).filter(p => p !== '' && p !== '.')
    }

    /**
     * Navigate to a directory handle given a path
     */
    async function getDirectoryHandle(
        dirPath: string,
        options?: { create?: boolean }
    ): Promise<FileSystemDirectoryHandle> {
        const parts = splitPath(dirPath)
        let current = rootHandle

        for (const part of parts) {
            try {
                current = await current.getDirectoryHandle(part, options)
            } catch (error) {
                throw createENOENT(dirPath)
            }
        }

        return current
    }

    /**
     * Get a file handle given a path
     */
    async function getFileHandle(
        filepath: string,
        options?: { create?: boolean }
    ): Promise<FileSystemFileHandle> {
        const parts = splitPath(filepath)
        const filename = parts.pop()

        if (!filename) {
            throw new Error(`EISDIR: illegal operation on a directory, '${filepath}'`)
        }

        const dirPath = parts.join('/')
        const dirHandle = parts.length > 0
            ? await getDirectoryHandle(dirPath, options?.create ? { create: true } : undefined)
            : rootHandle

        try {
            return await dirHandle.getFileHandle(filename, options)
        } catch (error) {
            throw createENOENT(filepath)
        }
    }

    /**
     * Get parent directory handle and entry name
     */
    async function getParentAndName(filepath: string): Promise<{
        parent: FileSystemDirectoryHandle
        name: string
    }> {
        const parts = splitPath(filepath)
        const name = parts.pop()

        if (!name) {
            throw new Error(`Invalid path: '${filepath}'`)
        }

        const parent = parts.length > 0
            ? await getDirectoryHandle(parts.join('/'))
            : rootHandle

        return { parent, name }
    }

    // ===== isomorphic-git fs interface =====

    const fs = {
        /**
         * Read file contents
         */
        async readFile(
            filepath: string,
            options?: { encoding?: EncodingType } | EncodingType
        ): Promise<Uint8Array | string> {
            const encoding = typeof options === 'string' ? options : options?.encoding

            try {
                const fileHandle = await getFileHandle(filepath)
                const file = await fileHandle.getFile()

                if (encoding === 'utf8') {
                    return await file.text()
                } else {
                    const buffer = await file.arrayBuffer()
                    return new Uint8Array(buffer)
                }
            } catch (error) {
                const err = error as Error
                if (err.message.includes('ENOENT')) {
                    throw error
                }
                throw createENOENT(filepath)
            }
        },

        /**
         * Write file contents
         */
        async writeFile(
            filepath: string,
            data: Uint8Array | string,
            _options?: { encoding?: EncodingType; mode?: number }
        ): Promise<void> {
            try {
                // Ensure parent directories exist
                const parts = splitPath(filepath)
                const filename = parts.pop()

                if (!filename) {
                    throw new Error(`Invalid path: '${filepath}'`)
                }

                let dirHandle = rootHandle
                for (const part of parts) {
                    dirHandle = await dirHandle.getDirectoryHandle(part, { create: true })
                }

                const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
                const writable = await fileHandle.createWritable()

                // Handle both string and Uint8Array data
                if (typeof data === 'string') {
                    await writable.write(data)
                } else {
                    // Convert Uint8Array to ArrayBuffer for compatibility
                    const buffer = data.buffer.slice(
                        data.byteOffset,
                        data.byteOffset + data.byteLength
                    ) as ArrayBuffer
                    await writable.write(buffer)
                }
                await writable.close()
            } catch (error) {
                throw new Error(`Failed to write file: '${filepath}' - ${(error as Error).message}`)
            }
        },

        /**
         * Delete a file
         */
        async unlink(filepath: string): Promise<void> {
            try {
                const { parent, name } = await getParentAndName(filepath)
                await parent.removeEntry(name)
            } catch (error) {
                throw createENOENT(filepath)
            }
        },

        /**
         * Read directory contents
         */
        async readdir(dirPath: string): Promise<string[]> {
            try {
                // Normalize path and check for root directory
                const normalizedPath = dirPath?.trim() || ''
                const isRoot = !normalizedPath ||
                    normalizedPath === '.' ||
                    normalizedPath === '/' ||
                    normalizedPath === './' ||
                    normalizedPath === '.\\'

                const dirHandle = isRoot ? rootHandle : await getDirectoryHandle(dirPath)
                const entries: string[] = []

                for await (const [name] of dirHandle.entries()) {
                    entries.push(name)
                }

                return entries
            } catch (error) {
                throw createENOENT(dirPath)
            }
        },

        /**
         * Create a directory
         */
        async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
            try {
                const parts = splitPath(dirPath)
                let current = rootHandle

                for (const part of parts) {
                    try {
                        current = await current.getDirectoryHandle(part, { create: true })
                    } catch (error) {
                        if (!options?.recursive) {
                            throw error
                        }
                        current = await current.getDirectoryHandle(part, { create: true })
                    }
                }
            } catch (error) {
                throw new Error(`Failed to create directory: '${dirPath}'`)
            }
        },

        /**
         * Remove a directory
         */
        async rmdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
            try {
                const { parent, name } = await getParentAndName(dirPath)
                await parent.removeEntry(name, { recursive: options?.recursive })
            } catch (error) {
                throw createENOENT(dirPath)
            }
        },

        /**
         * Get file/directory stats
         */
        async stat(filepath: string): Promise<StatResult> {
            return fs.lstat(filepath)
        },

        /**
         * Get file/directory stats (same as stat for now, no symlink support)
         */
        async lstat(filepath: string): Promise<StatResult> {
            // Normalize path - remove leading ./ and handle edge cases
            let normalizedPath = (filepath || '').trim()

            // Remove leading './' repeatedly
            while (normalizedPath.startsWith('./')) {
                normalizedPath = normalizedPath.slice(2)
            }
            // Remove leading '.\' repeatedly (Windows)
            while (normalizedPath.startsWith('.\\')) {
                normalizedPath = normalizedPath.slice(2)
            }
            // Remove trailing '/.' or '\.'
            while (normalizedPath.endsWith('/.') || normalizedPath.endsWith('\\.')) {
                normalizedPath = normalizedPath.slice(0, -2)
            }
            // Handle standalone '.'
            if (normalizedPath === '.' || normalizedPath === '') {
                normalizedPath = ''
            }

            const isRoot = normalizedPath === '' || normalizedPath === '/'

            try {
                if (isRoot) {
                    // Root directory
                    const now = Date.now()
                    return {
                        type: 'dir',
                        mode: 0o755,
                        size: 0,
                        ino: 0,
                        mtimeMs: now,
                        ctimeMs: now,
                        uid: 0,
                        gid: 0,
                        dev: 0,
                        isFile: () => false,
                        isDirectory: () => true,
                        isSymbolicLink: () => false,
                    }
                }

                const { parent, name } = await getParentAndName(filepath)

                // Try as file first
                try {
                    const fileHandle = await parent.getFileHandle(name)
                    const file = await fileHandle.getFile()

                    return {
                        type: 'file',
                        mode: 0o644,
                        size: file.size,
                        ino: 0,
                        mtimeMs: file.lastModified,
                        ctimeMs: file.lastModified, // Use lastModified for both
                        uid: 0,
                        gid: 0,
                        dev: 0,
                        isFile: () => true,
                        isDirectory: () => false,
                        isSymbolicLink: () => false,
                    }
                } catch {
                    // Try as directory
                    try {
                        await parent.getDirectoryHandle(name)
                        const now = Date.now()
                        return {
                            type: 'dir',
                            mode: 0o755,
                            size: 0,
                            ino: 0,
                            mtimeMs: now,
                            ctimeMs: now,
                            uid: 0,
                            gid: 0,
                            dev: 0,
                            isFile: () => false,
                            isDirectory: () => true,
                            isSymbolicLink: () => false,
                        }
                    } catch {
                        throw createENOENT(filepath)
                    }
                }
            } catch (error) {
                const err = error as Error
                if (err.message.includes('ENOENT')) {
                    throw error
                }
                throw createENOENT(filepath)
            }
        },

        /**
         * Read symbolic link (not supported in File System Access API)
         */
        async readlink(_filepath: string): Promise<string> {
            throw new Error('ENOENT: symbolic links not supported')
        },

        /**
         * Create symbolic link (not supported in File System Access API)
         */
        async symlink(_target: string, _filepath: string): Promise<void> {
            throw new Error('EPERM: symbolic links not supported')
        },

        /**
         * Change file permissions (no-op in File System Access API)
         */
        async chmod(_filepath: string, _mode: number): Promise<void> {
            // No-op: File System Access API doesn't support file permissions
        },

        /**
         * Rename/move a file or directory
         */
        async rename(oldPath: string, newPath: string): Promise<void> {
            try {
                // Read the old file
                const content = await fs.readFile(oldPath)

                // Write to new location
                await fs.writeFile(newPath, content)

                // Delete old file
                await fs.unlink(oldPath)
            } catch (error) {
                throw new Error(`Failed to rename '${oldPath}' to '${newPath}'`)
            }
        },
    }

    return fs
}

/**
 * Type for the fs adapter
 */
export type FsAdapter = ReturnType<typeof createFsAdapter>
