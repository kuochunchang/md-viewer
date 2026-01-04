/**
 * useGitSync - Core Git synchronization logic
 * 
 * Provides Git operations using isomorphic-git with File System Access API
 */

import * as git from 'isomorphic-git'
import http from 'isomorphic-git/http/web'
import { computed, ref } from 'vue'
import { createFsAdapter, type FsAdapter } from '../lib/fsAdapter'
import { useGitStore } from '../stores/gitStore'
import type {
    CommitMessageStyle,
    FileChange,
    PullResult,
    PushResult,
    SyncResult,
    VaultGitStatus,
} from '../types/git'

// CORS proxy for GitHub (needed for browser requests)
const CORS_PROXY = 'https://cors.isomorphic-git.org'

// Cache for fs adapters
const fsAdapterCache = new Map<string, FsAdapter>()

export function useGitSync() {
    const gitStore = useGitStore()

    // Processing state
    const isProcessing = ref(false)
    const currentOperation = ref<string | null>(null)

    // ===== Helper Functions =====

    /**
     * Get or create fs adapter for a vault
     */
    function getFsAdapter(
        vaultId: string,
        handle: FileSystemDirectoryHandle
    ): FsAdapter {
        if (!fsAdapterCache.has(vaultId)) {
            fsAdapterCache.set(vaultId, createFsAdapter(handle))
        }
        return fsAdapterCache.get(vaultId)!
    }

    /**
     * Clear fs adapter cache for a vault
     */
    function clearFsAdapter(vaultId: string): void {
        fsAdapterCache.delete(vaultId)
    }

    /**
     * Get authentication options for git operations
     * Uses 'x-access-token' format which is recommended for GitHub PAT
     */
    function getAuthOptions() {
        const creds = gitStore.getCredentials()
        if (!creds?.token) {
            throw new Error('Git credentials not configured')
        }

        return {
            onAuth: () => ({
                username: 'x-access-token',
                password: creds.token,
            }),
        }
    }

    /**
     * Get author info for commits
     */
    function getAuthor() {
        const creds = gitStore.getCredentials()
        return {
            name: creds?.userName || 'md-viewer',
            email: creds?.userEmail || 'md-viewer@local',
            timestamp: Math.floor(Date.now() / 1000),
            timezoneOffset: new Date().getTimezoneOffset(),
        }
    }

    // ===== Git Status Functions =====

    /**
     * Check if a directory is a Git repository
     */
    async function isGitInitialized(
        vaultId: string,
        handle: FileSystemDirectoryHandle
    ): Promise<boolean> {
        try {
            const fs = getFsAdapter(vaultId, handle)
            const files = await fs.readdir('.git')
            return files.includes('HEAD')
        } catch {
            return false
        }
    }

    /**
     * Check if Obsidian Git plugin is installed
     */
    async function hasObsidianGit(
        vaultId: string,
        handle: FileSystemDirectoryHandle
    ): Promise<boolean> {
        try {
            const fs = getFsAdapter(vaultId, handle)
            await fs.readdir('.obsidian/plugins/obsidian-git')
            return true
        } catch {
            return false
        }
    }

    /**
     * Get current branch name
     */
    async function getCurrentBranch(
        vaultId: string,
        handle: FileSystemDirectoryHandle
    ): Promise<string | null> {
        try {
            const fs = getFsAdapter(vaultId, handle)
            return await git.currentBranch({
                fs,
                dir: '.',
                fullname: false,
            }) || null
        } catch {
            return null
        }
    }

    /**
     * Get list of remotes
     */
    async function getRemotes(
        vaultId: string,
        handle: FileSystemDirectoryHandle
    ): Promise<Array<{ remote: string; url: string }>> {
        try {
            const fs = getFsAdapter(vaultId, handle)
            return await git.listRemotes({ fs, dir: '.' })
        } catch {
            return []
        }
    }

    /**
     * Get full Git status for a vault
     */
    async function getStatus(
        vaultId: string,
        handle: FileSystemDirectoryHandle
    ): Promise<VaultGitStatus> {
        const fs = getFsAdapter(vaultId, handle)

        const isRepo = await isGitInitialized(vaultId, handle)
        if (!isRepo) {
            return {
                isGitRepo: false,
                hasRemote: false,
                currentBranch: null,
                changedFilesCount: 0,
                hasUnpushedCommits: false,
                lastSyncTime: gitStore.vaultConfigs[vaultId]?.status.lastSyncTime || null,
                syncStatus: 'idle',
                errorMessage: null,
                hasObsidianGit: await hasObsidianGit(vaultId, handle),
            }
        }

        const remotes = await getRemotes(vaultId, handle)
        const branch = await getCurrentBranch(vaultId, handle)
        const changes = await getChangedFiles(vaultId, handle)
        const obsGit = await hasObsidianGit(vaultId, handle)

        // Check for unpushed commits
        let hasUnpushed = false
        if (remotes.length > 0 && branch) {
            try {
                const localRef = await git.resolveRef({ fs, dir: '.', ref: branch })
                const remoteRef = await git.resolveRef({
                    fs,
                    dir: '.',
                    ref: `refs/remotes/origin/${branch}`
                })
                hasUnpushed = localRef !== remoteRef
            } catch {
                // Remote ref might not exist yet
                hasUnpushed = true
            }
        }

        return {
            isGitRepo: true,
            hasRemote: remotes.length > 0,
            currentBranch: branch,
            changedFilesCount: changes.length,
            hasUnpushedCommits: hasUnpushed,
            lastSyncTime: gitStore.vaultConfigs[vaultId]?.status.lastSyncTime || null,
            syncStatus: gitStore.vaultConfigs[vaultId]?.status.syncStatus || 'idle',
            errorMessage: gitStore.vaultConfigs[vaultId]?.status.errorMessage || null,
            hasObsidianGit: obsGit,
        }
    }

    /**
     * Get list of changed files
     */
    async function getChangedFiles(
        vaultId: string,
        handle: FileSystemDirectoryHandle
    ): Promise<FileChange[]> {
        try {
            const fs = getFsAdapter(vaultId, handle)

            const statusMatrix = await git.statusMatrix({
                fs,
                dir: '.',
                filter: (f: string) => !f.startsWith('.git/'),
            })

            const changes: FileChange[] = []

            for (const [filepath, headStatus, workdirStatus] of statusMatrix) {
                // [filepath, HEAD, WORKDIR, STAGE]
                // 0 = absent, 1 = present unchanged, 2 = present modified

                if (headStatus === workdirStatus) {
                    continue // No change
                }

                let status: FileChange['status']
                if (headStatus === 0 && workdirStatus === 2) {
                    status = 'added'
                } else if (headStatus === 1 && workdirStatus === 0) {
                    status = 'deleted'
                } else {
                    status = 'modified'
                }

                const name = filepath.split('/').pop() || filepath
                changes.push({ path: filepath, name, status })
            }

            return changes
        } catch {
            return []
        }
    }

    // ===== Git Operations =====

    /**
     * Initialize a new Git repository
     */
    async function initializeGit(
        vaultId: string,
        handle: FileSystemDirectoryHandle
    ): Promise<void> {
        const fs = getFsAdapter(vaultId, handle)

        gitStore.setSyncStatus(vaultId, 'syncing')
        currentOperation.value = 'Initializing Git repository...'

        try {
            await git.init({
                fs,
                dir: '.',
                defaultBranch: 'main',
            })

            // Create initial .gitignore
            const gitignore = `# Obsidian
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/plugins/*/data.json
.trash/

# System files
.DS_Store
Thumbs.db
`
            await fs.writeFile('.gitignore', gitignore)

            // Stage and commit
            await git.add({ fs, dir: '.', filepath: '.gitignore' })
            await git.commit({
                fs,
                dir: '.',
                message: 'Initial commit',
                author: getAuthor(),
            })

            const status = await getStatus(vaultId, handle)
            gitStore.updateVaultStatus(vaultId, status)
            gitStore.recordSync(vaultId)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to initialize Git'
            gitStore.setError(vaultId, message)
            throw error
        } finally {
            currentOperation.value = null
        }
    }

    /**
     * Set remote URL
     */
    async function setRemote(
        vaultId: string,
        handle: FileSystemDirectoryHandle,
        url: string,
        remoteName: string = 'origin'
    ): Promise<void> {
        const fs = getFsAdapter(vaultId, handle)

        try {
            // Check if remote already exists
            const remotes = await getRemotes(vaultId, handle)
            const existingRemote = remotes.find(r => r.remote === remoteName)

            if (existingRemote) {
                // Delete existing remote
                await git.deleteRemote({ fs, dir: '.', remote: remoteName })
            }

            // Add new remote
            await git.addRemote({
                fs,
                dir: '.',
                remote: remoteName,
                url,
            })

            gitStore.setVaultRemote(vaultId, url, remoteName)

            const status = await getStatus(vaultId, handle)
            gitStore.updateVaultStatus(vaultId, status)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to set remote'
            gitStore.setError(vaultId, message)
            throw error
        }
    }

    /**
     * Pull changes from remote
     */
    async function pull(
        vaultId: string,
        handle: FileSystemDirectoryHandle
    ): Promise<PullResult> {
        const fs = getFsAdapter(vaultId, handle)

        gitStore.setSyncStatus(vaultId, 'pulling')
        currentOperation.value = 'Pulling changes...'

        try {
            const branch = await getCurrentBranch(vaultId, handle) || 'main'
            const remote = gitStore.vaultConfigs[vaultId]?.remote
            const creds = gitStore.getCredentials()

            if (!remote) {
                throw new Error('No remote configured')
            }

            // Build authenticated URL for fetch
            // Format: https://x-access-token:TOKEN@github.com/user/repo.git
            let fetchUrl = remote.url
            if (creds?.token && remote.url.startsWith('https://')) {
                const urlObj = new URL(remote.url)
                urlObj.username = 'x-access-token'
                urlObj.password = creds.token
                fetchUrl = urlObj.toString()
            }

            // Try to fetch from remote - using authenticated URL
            try {
                await git.fetch({
                    fs,
                    http,
                    dir: '.',
                    url: fetchUrl,
                    remote: remote.name,  // Needed to create origin/* refs
                    ref: branch,
                    singleBranch: true,
                    corsProxy: CORS_PROXY,
                })

                // Debug: Check what refs were created
                const refs = await git.listServerRefs({
                    http,
                    url: fetchUrl,
                    corsProxy: CORS_PROXY,
                })
                console.log('[pull] Server refs:', refs.map(r => r.ref))

            } catch (fetchError) {
                const err = fetchError as Error
                // Handle common fetch errors that indicate empty/new remote
                if (err.message.includes('401') ||
                    err.message.includes('404') ||
                    err.message.includes('Could not find') ||
                    err.message.includes('does not appear to be a git repository') ||
                    err.message.includes('empty')) {
                    // Remote might be empty or doesn't exist yet - this is OK for first sync
                    gitStore.setSyncStatus(vaultId, 'idle')
                    return {
                        success: true,
                        updatedFiles: 0,
                        fastForward: false,
                        hasConflicts: false,
                        conflictFiles: [],
                    }
                }
                throw fetchError
            }

            // Try to merge - but handle missing remote refs
            try {
                await git.merge({
                    fs,
                    dir: '.',
                    theirs: `origin/${branch}`,
                    author: getAuthor(),
                })
            } catch (mergeError) {
                const err = mergeError as Error
                // Handle missing remote ref (empty remote or branch doesn't exist)
                if (err.message.includes('Could not find') ||
                    err.message.includes('refs/remotes') ||
                    err.message.includes('does not exist')) {
                    // No remote branch to merge - this is OK for first sync
                    console.warn('[pull] Merge skipped (remote branch not found):', err.message)
                    gitStore.setSyncStatus(vaultId, 'idle')
                    return {
                        success: true,
                        updatedFiles: 0,
                        fastForward: false,
                        hasConflicts: false,
                        conflictFiles: [],
                    }
                }
                // Check if it's a conflict
                if (err.message.includes('conflict')) {
                    return {
                        success: false,
                        updatedFiles: 0,
                        fastForward: false,
                        hasConflicts: true,
                        conflictFiles: [], // TODO: parse conflict files
                        error: 'Merge conflicts detected',
                    }
                }
                throw mergeError
            }

            gitStore.recordSync(vaultId)

            return {
                success: true,
                updatedFiles: 0, // TODO: calculate actual updated files
                fastForward: true,
                hasConflicts: false,
                conflictFiles: [],
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Pull failed'
            gitStore.setError(vaultId, message)
            return {
                success: false,
                updatedFiles: 0,
                fastForward: false,
                hasConflicts: false,
                conflictFiles: [],
                error: message,
            }
        } finally {
            currentOperation.value = null
        }
    }

    /**
     * Commit all changes
     */
    async function commit(
        vaultId: string,
        handle: FileSystemDirectoryHandle,
        message: string
    ): Promise<string | null> {
        const fs = getFsAdapter(vaultId, handle)

        gitStore.setSyncStatus(vaultId, 'committing')
        currentOperation.value = 'Committing changes...'

        try {
            // Stage all changes
            await git.add({ fs, dir: '.', filepath: '.' })

            // Also stage deleted files
            const statusMatrix = await git.statusMatrix({
                fs,
                dir: '.',
                filter: (f: string) => !f.startsWith('.git/'),
            })

            for (const [filepath, headStatus, workdirStatus] of statusMatrix) {
                if (headStatus === 1 && workdirStatus === 0) {
                    // File was deleted
                    await git.remove({ fs, dir: '.', filepath })
                }
            }

            // Check if there are staged changes
            const status = await git.statusMatrix({ fs, dir: '.' })
            const hasChanges = status.some(
                ([, head, workdir, stage]) => head !== stage || workdir !== stage
            )

            if (!hasChanges) {
                gitStore.setSyncStatus(vaultId, 'idle')
                return null
            }

            // Commit
            const sha = await git.commit({
                fs,
                dir: '.',
                message,
                author: getAuthor(),
            })

            const vaultStatus = await getStatus(vaultId, handle)
            gitStore.updateVaultStatus(vaultId, vaultStatus)

            return sha
        } catch (error) {
            console.error('[commit] Error:', error)
            const errorMessage = error instanceof Error ? error.message : 'Commit failed'
            gitStore.setError(vaultId, errorMessage)
            throw error
        } finally {
            currentOperation.value = null
        }
    }

    /**
     * Push changes to remote
     */
    async function push(
        vaultId: string,
        handle: FileSystemDirectoryHandle
    ): Promise<PushResult> {
        const fs = getFsAdapter(vaultId, handle)

        gitStore.setSyncStatus(vaultId, 'pushing')
        currentOperation.value = 'Pushing changes...'

        try {
            const branch = await getCurrentBranch(vaultId, handle) || 'main'
            const remote = gitStore.vaultConfigs[vaultId]?.remote

            if (!remote) {
                throw new Error('No remote configured')
            }

            await git.push({
                fs,
                http,
                dir: '.',
                remote: remote.name,
                ref: branch,
                corsProxy: CORS_PROXY,
                ...getAuthOptions(),
            })

            gitStore.recordSync(vaultId)

            return {
                success: true,
                commitsPushed: 1, // Simplified
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Push failed'
            gitStore.setError(vaultId, message)
            return {
                success: false,
                commitsPushed: 0,
                error: message,
            }
        } finally {
            currentOperation.value = null
        }
    }

    /**
     * Check if a remote repository has any commits (is not empty)
     */
    async function isRemoteEmpty(vaultId: string): Promise<boolean> {
        const creds = gitStore.getCredentials()
        if (!creds?.token) {
            return true // Assume empty if no credentials
        }

        const remoteUrl = gitStore.vaultConfigs[vaultId]?.remote?.url
        if (!remoteUrl) {
            return true
        }

        const parsed = parseGitHubUrl(remoteUrl)
        if (!parsed) {
            return true
        }

        try {
            const response = await fetch(
                `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/branches`,
                {
                    headers: {
                        'Authorization': `Bearer ${creds.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                    },
                }
            )

            if (response.status === 200) {
                const branches = await response.json()
                return !branches || branches.length === 0
            }
            // If 404 or other error, assume empty
            return true
        } catch {
            return true
        }
    }

    /**
     * Full sync: Pull -> Commit -> Push
     * Handles empty remote repositories by skipping pull
     */
    async function syncAll(
        vaultId: string,
        handle: FileSystemDirectoryHandle,
        commitMessage: string
    ): Promise<SyncResult> {
        gitStore.setSyncStatus(vaultId, 'syncing')
        isProcessing.value = true

        try {
            // Check if remote is empty (new repository)
            const remoteEmpty = await isRemoteEmpty(vaultId)

            let pulledFiles = 0

            // 1. Pull first (only if remote has content)
            if (!remoteEmpty) {
                const pullResult = await pull(vaultId, handle)
                if (!pullResult.success || pullResult.hasConflicts) {
                    return {
                        success: false,
                        pulledFiles: pullResult.updatedFiles,
                        pushedFiles: 0,
                        hasConflicts: pullResult.hasConflicts,
                        conflictFiles: pullResult.conflictFiles,
                        error: pullResult.error || 'Pull failed',
                    }
                }
                pulledFiles = pullResult.updatedFiles
            }

            // 2. Commit local changes
            const sha = await commit(vaultId, handle, commitMessage)

            // 3. Push if there are commits
            if (sha) {
                const pushResult = await push(vaultId, handle)
                if (!pushResult.success) {
                    return {
                        success: false,
                        pulledFiles,
                        pushedFiles: 0,
                        commitHash: sha,
                        hasConflicts: false,
                        conflictFiles: [],
                        error: pushResult.error,
                    }
                }

                return {
                    success: true,
                    pulledFiles,
                    pushedFiles: pushResult.commitsPushed,
                    commitHash: sha,
                    hasConflicts: false,
                    conflictFiles: [],
                }
            }

            // No local changes to push
            return {
                success: true,
                pulledFiles,
                pushedFiles: 0,
                hasConflicts: false,
                conflictFiles: [],
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Sync failed'
            gitStore.setError(vaultId, message)
            return {
                success: false,
                pulledFiles: 0,
                pushedFiles: 0,
                hasConflicts: false,
                conflictFiles: [],
                error: message,
            }
        } finally {
            isProcessing.value = false
        }
    }

    // ===== Commit Message Generation =====

    /**
     * Generate commit message based on style
     */
    function generateCommitMessage(
        changes: FileChange[],
        style: CommitMessageStyle,
        template?: string,
        vaultName?: string
    ): string {
        const date = new Date().toISOString().slice(0, 16).replace('T', ' ')

        switch (style) {
            case 'smart':
                return generateSmartMessage(changes, date)

            case 'timestamp':
                return `vault backup: ${date}`

            case 'custom':
                return renderTemplate(template || 'vault backup: {{date}}', {
                    date,
                    count: changes.length.toString(),
                    files: changes.map(c => c.name).join(', '),
                    vault: vaultName || 'vault',
                })

            case 'ai':
                // AI generation is handled externally via useGeminiAI
                // Fall back to smart if called directly
                return generateSmartMessage(changes, date)

            default:
                return `vault backup: ${date}`
        }
    }

    function generateSmartMessage(changes: FileChange[], date: string): string {
        if (changes.length === 0) {
            return `sync: ${date}`
        }

        if (changes.length === 1) {
            const file = changes[0]
            const action = file.status === 'added' ? 'Add' :
                file.status === 'deleted' ? 'Delete' : 'Update'
            return `${action} ${file.name}`
        }

        if (changes.length <= 3) {
            const names = changes.map(f => f.name).join(', ')
            return `Update ${names}`
        }

        return `vault backup: ${date} (${changes.length} files)`
    }

    function renderTemplate(
        template: string,
        vars: Record<string, string>
    ): string {
        let result = template
        for (const [key, value] of Object.entries(vars)) {
            result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
        }
        return result
    }

    // ===== Clone =====

    /**
     * Clone a repository to a new directory
     */
    async function cloneRepo(
        vaultId: string,
        handle: FileSystemDirectoryHandle,
        url: string
    ): Promise<boolean> {
        const fs = getFsAdapter(vaultId, handle)

        gitStore.setSyncStatus(vaultId, 'syncing')
        currentOperation.value = 'Cloning repository...'

        try {
            await git.clone({
                fs,
                http,
                dir: '.',
                url,
                singleBranch: true,
                depth: 10, // Shallow clone for speed
                corsProxy: CORS_PROXY,
                ...getAuthOptions(),
            })

            gitStore.setVaultRemote(vaultId, url)
            gitStore.recordSync(vaultId)

            return true
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Clone failed'
            gitStore.setError(vaultId, message)
            return false
        } finally {
            currentOperation.value = null
        }
    }

    // ===== GitHub API Functions =====

    /**
     * Parse GitHub URL to extract owner and repo name
     */
    function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
        // Support various formats:
        // https://github.com/owner/repo.git
        // https://github.com/owner/repo
        // git@github.com:owner/repo.git
        const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/.]+)(\.git)?/i)
        const sshMatch = url.match(/git@github\.com:([^/]+)\/([^/.]+)(\.git)?/i)

        const match = httpsMatch || sshMatch
        if (match) {
            return { owner: match[1], repo: match[2] }
        }
        return null
    }

    /**
     * Check if a GitHub repository exists
     */
    async function checkRepoExists(url: string): Promise<boolean> {
        const creds = gitStore.getCredentials()
        if (!creds?.token) {
            throw new Error('Git credentials not configured')
        }

        const parsed = parseGitHubUrl(url)
        if (!parsed) {
            throw new Error('Invalid GitHub URL')
        }

        try {
            const response = await fetch(
                `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
                {
                    headers: {
                        'Authorization': `Bearer ${creds.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                    },
                }
            )

            if (response.status === 200) {
                return true
            }
            if (response.status === 404) {
                return false
            }

            // Other errors
            const data = await response.json()
            throw new Error(data.message || `GitHub API error: ${response.status}`)
        } catch (error) {
            if (error instanceof Error && error.message.includes('GitHub API')) {
                throw error
            }
            // Network error or other - assume repo doesn't exist
            return false
        }
    }

    /**
     * Create a new GitHub repository
     */
    async function createRemoteRepo(
        repoName: string,
        isPrivate: boolean = true,
        description?: string
    ): Promise<string> {
        const creds = gitStore.getCredentials()
        if (!creds?.token) {
            throw new Error('Git credentials not configured')
        }

        currentOperation.value = 'Creating repository on GitHub...'

        try {
            const response = await fetch('https://api.github.com/user/repos', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${creds.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: repoName,
                    description: description || `Obsidian vault synced by md-viewer`,
                    private: isPrivate,
                    auto_init: false, // We'll push our existing content
                }),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.message || `Failed to create repository: ${response.status}`)
            }

            const repo = await response.json()
            return repo.clone_url // Returns https://github.com/user/repo.git
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create repository'
            throw new Error(message)
        } finally {
            currentOperation.value = null
        }
    }

    /**
     * Smart setup remote - checks if repo exists, creates if not, then sets up remote
     */
    async function smartSetupRemote(
        vaultId: string,
        handle: FileSystemDirectoryHandle,
        url: string,
        createIfNotExists: boolean = false,
        isPrivate: boolean = true
    ): Promise<{ success: boolean; created: boolean; error?: string }> {
        try {
            // Check if repo exists
            const exists = await checkRepoExists(url)

            if (!exists && !createIfNotExists) {
                return {
                    success: false,
                    created: false,
                    error: 'Repository does not exist on GitHub',
                }
            }

            let finalUrl = url

            if (!exists && createIfNotExists) {
                // Create the repo
                const parsed = parseGitHubUrl(url)
                if (!parsed) {
                    return {
                        success: false,
                        created: false,
                        error: 'Invalid GitHub URL',
                    }
                }

                finalUrl = await createRemoteRepo(parsed.repo, isPrivate)
            }

            // Set up the remote
            await setRemote(vaultId, handle, finalUrl)

            // If this is a new repo, do initial push
            if (!exists) {
                const branch = await getCurrentBranch(vaultId, handle) || 'main'
                const fs = getFsAdapter(vaultId, handle)

                currentOperation.value = 'Pushing initial commit...'

                await git.push({
                    fs,
                    http,
                    dir: '.',
                    remote: 'origin',
                    ref: branch,
                    corsProxy: CORS_PROXY,
                    ...getAuthOptions(),
                })

                gitStore.recordSync(vaultId)
            }

            return {
                success: true,
                created: !exists,
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to setup remote'
            return {
                success: false,
                created: false,
                error: message,
            }
        } finally {
            currentOperation.value = null
        }
    }

    /**
     * Get suggested repo name from vault name
     */
    function suggestRepoName(vaultName: string): string {
        return vaultName
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            || 'my-vault'
    }

    /**
     * Get current GitHub username from token
     */
    async function getGitHubUsername(): Promise<string | null> {
        const creds = gitStore.getCredentials()
        if (!creds?.token) {
            return null
        }

        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `Bearer ${creds.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
            })

            if (response.ok) {
                const user = await response.json()
                return user.login
            }
            return null
        } catch {
            return null
        }
    }

    /**
     * Reset Git repository - deletes .git folder and clears config
     */
    async function resetGit(
        vaultId: string,
        handle: FileSystemDirectoryHandle
    ): Promise<boolean> {
        currentOperation.value = 'Resetting Git repository...'
        gitStore.setSyncStatus(vaultId, 'syncing')

        try {
            // 1. Remove .git directory
            try {
                await handle.removeEntry('.git', { recursive: true })
            } catch (error) {
                console.warn('Failed to remove .git folder:', error)
                // Might have already been removed or access denied, but we continue to clear config
            }

            // 2. Clear vault config from store
            // gitStore.removeVaultConfig(vaultId) // We don't remove the whole config, we want to reset it
            // Reset status and remote in the existing config
            gitStore.updateVaultStatus(vaultId, {
                isGitRepo: false,
                hasRemote: false,
                currentBranch: null,
                changedFilesCount: 0,
                hasUnpushedCommits: false,
                lastSyncTime: null,
                syncStatus: 'idle',
                errorMessage: null,
            })
            // Clear remote
            const config = gitStore.vaultConfigs[vaultId]
            if (config) {
                config.remote = null
                gitStore.saveToStorage()
            }

            // Clear fs adapter cache
            clearFsAdapter(vaultId)

            return true
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Reset failed'
            gitStore.setError(vaultId, message)
            throw error
        } finally {
            currentOperation.value = null
        }
    }

    return {
        // State
        isProcessing: computed(() => isProcessing.value),
        currentOperation: computed(() => currentOperation.value),

        // Status
        isGitInitialized,
        hasObsidianGit,
        getCurrentBranch,
        getRemotes,
        getStatus,
        getChangedFiles,

        // Operations
        initializeGit,
        setRemote,
        pull,
        commit,
        push,
        syncAll,
        cloneRepo,

        // GitHub API
        checkRepoExists,
        createRemoteRepo,
        smartSetupRemote,
        suggestRepoName,
        getGitHubUsername,

        // Commit message
        generateCommitMessage,

        // Cleanup
        clearFsAdapter,
        resetGit,
    }
}
