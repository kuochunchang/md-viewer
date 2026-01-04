/**
 * useGitAutoSync - Automatic Git status checking and sync
 * 
 * Provides:
 * - Periodic status checking (every 30 seconds)
 * - Remote fetch checking (every 10 minutes)
 * - Real-time status updates when changes are detected
 * - Auto sync with configurable intervals (minimum 1 minute)
 */

import * as git from 'isomorphic-git'
import http from 'isomorphic-git/http/web'
import { ref, watch } from 'vue'
import { createFsAdapter } from '../lib/fsAdapter'
import { useFileSystemStore } from '../stores/fileSystemStore'
import { useGitStore } from '../stores/gitStore'
import { useGitSync } from './useGitSync'

// Status check interval (30 seconds) - checks local changes only
const STATUS_CHECK_INTERVAL = 30 * 1000

// Remote fetch interval (10 minutes) - fetches from remote to check for updates
const REMOTE_FETCH_INTERVAL = 10 * 60 * 1000

// Minimum auto sync interval (1 minute)
const MIN_AUTO_SYNC_INTERVAL = 1 * 60 * 1000

// CORS proxy for GitHub
const CORS_PROXY = 'https://cors.isomorphic-git.org'

// Store interval IDs by vault
const statusCheckIntervals = new Map<string, number>()
const remoteFetchIntervals = new Map<string, number>()
const autoSyncIntervals = new Map<string, number>()

// Track if auto sync is globally started
let isStarted = false

export function useGitAutoSync() {
    const gitStore = useGitStore()
    const fileSystemStore = useFileSystemStore()
    const {
        getStatus,
        syncAll,
        getChangedFiles,
        generateCommitMessage,
        getCurrentBranch,
    } = useGitSync()

    // Reactive state
    const isAutoSyncRunning = ref(false)
    const lastStatusCheck = ref<Record<string, number>>({})
    const lastRemoteFetch = ref<Record<string, number>>({})

    /**
     * Check and update Git status for a single vault (local only)
     */
    async function checkVaultStatus(vaultId: string): Promise<void> {
        const vault = fileSystemStore.vaults.find(v => v.id === vaultId)
        if (!vault?.handle) {
            return
        }

        const config = gitStore.vaultConfigs[vaultId]
        if (!config?.status.isGitRepo) {
            return
        }

        // Skip if currently syncing
        if (gitStore.isVaultSyncing(vaultId)) {
            return
        }

        try {
            const status = await getStatus(vaultId, vault.handle)

            // Update the store with new status
            gitStore.updateVaultStatus(vaultId, {
                changedFilesCount: status.changedFilesCount,
                hasUnpushedCommits: status.hasUnpushedCommits,
                currentBranch: status.currentBranch,
                hasRemote: status.hasRemote,
            })

            lastStatusCheck.value[vaultId] = Date.now()
            console.log(`[GitAutoSync] Status checked for ${vault.name}:`, {
                changedFiles: status.changedFilesCount,
                hasUnpushedCommits: status.hasUnpushedCommits,
            })
        } catch (error) {
            console.error(`[GitAutoSync] Error checking status for ${vault.name}:`, error)
        }
    }

    /**
     * Fetch from remote and check for updates available
     */
    async function fetchRemoteUpdates(vaultId: string): Promise<void> {
        const vault = fileSystemStore.vaults.find(v => v.id === vaultId)
        if (!vault?.handle) {
            return
        }

        const config = gitStore.vaultConfigs[vaultId]
        if (!config?.status.isGitRepo || !config.status.hasRemote) {
            return
        }

        // Skip if currently syncing
        if (gitStore.isVaultSyncing(vaultId)) {
            return
        }

        // Need credentials for fetch
        const creds = gitStore.getCredentials()
        if (!creds?.token) {
            return
        }

        try {
            const fs = createFsAdapter(vault.handle)
            const branch = await getCurrentBranch(vaultId, vault.handle) || 'main'
            const remote = config.remote

            if (!remote) {
                return
            }

            // Build authenticated URL
            let fetchUrl = remote.url
            if (remote.url.startsWith('https://')) {
                const urlObj = new URL(remote.url)
                urlObj.username = 'x-access-token'
                urlObj.password = creds.token
                fetchUrl = urlObj.toString()
            }

            // Get local HEAD before fetch
            let localRef: string | null = null
            try {
                localRef = await git.resolveRef({ fs, dir: '.', ref: branch })
            } catch {
                // Branch might not exist locally
            }

            // Fetch from remote
            await git.fetch({
                fs,
                http,
                dir: '.',
                url: fetchUrl,
                remote: remote.name,
                ref: branch,
                singleBranch: true,
                corsProxy: CORS_PROXY,
            })

            // Get remote HEAD after fetch
            let remoteRef: string | null = null
            try {
                remoteRef = await git.resolveRef({
                    fs,
                    dir: '.',
                    ref: `refs/remotes/${remote.name}/${branch}`
                })
            } catch {
                // Remote ref might not exist
            }

            // Check if remote has updates we don't have
            const hasRemoteUpdates = !!(remoteRef && localRef && remoteRef !== localRef)

            // Check if we're behind (remote has commits we don't have)
            let isBehind = false
            if (hasRemoteUpdates && localRef && remoteRef) {
                try {
                    // Check if remote ref is ancestor of local (meaning local is ahead)
                    const isAncestor = await git.isDescendent({
                        fs,
                        dir: '.',
                        oid: localRef,
                        ancestor: remoteRef,
                    })
                    // If local is not descended from remote, we need to pull
                    isBehind = !isAncestor
                } catch {
                    // If check fails, assume updates available
                    isBehind = true
                }
            }

            gitStore.updateVaultStatus(vaultId, {
                hasRemoteUpdates: isBehind,
            })

            lastRemoteFetch.value[vaultId] = Date.now()
            console.log(`[GitAutoSync] Remote fetch completed for ${vault.name}:`, {
                hasRemoteUpdates: isBehind,
                localRef: localRef?.slice(0, 7),
                remoteRef: remoteRef?.slice(0, 7),
            })
        } catch (error) {
            // Don't log network errors too verbosely
            const err = error as Error
            if (err.message.includes('401') || err.message.includes('403')) {
                console.warn(`[GitAutoSync] Authentication failed for ${vault.name}`)
            } else if (err.message.includes('404')) {
                console.warn(`[GitAutoSync] Remote not found for ${vault.name}`)
            } else {
                console.error(`[GitAutoSync] Error fetching remote for ${vault.name}:`, error)
            }
        }
    }

    /**
     * Check status for all Git-enabled vaults
     */
    async function checkAllVaultsStatus(): Promise<void> {
        const vaults = fileSystemStore.vaults

        for (const vault of vaults) {
            const config = gitStore.vaultConfigs[vault.id]
            if (config?.status.isGitRepo) {
                await checkVaultStatus(vault.id)
            }
        }
    }

    /**
     * Perform auto sync for a single vault
     */
    async function autoSyncVault(vaultId: string): Promise<void> {
        const vault = fileSystemStore.vaults.find(v => v.id === vaultId)
        if (!vault?.handle) {
            return
        }

        const config = gitStore.vaultConfigs[vaultId]
        if (!config?.status.isGitRepo || !config.status.hasRemote) {
            return
        }

        // Check if auto sync is enabled for this vault
        if (!config.syncSettings.autoSyncEnabled) {
            return
        }

        // Skip if currently syncing
        if (gitStore.isVaultSyncing(vaultId)) {
            return
        }

        // Check if there are changes to sync
        const status = await getStatus(vaultId, vault.handle)
        if (status.changedFilesCount === 0 && !status.hasUnpushedCommits) {
            console.log(`[GitAutoSync] No changes to sync for ${vault.name}`)
            return
        }

        try {
            isAutoSyncRunning.value = true
            console.log(`[GitAutoSync] Auto syncing ${vault.name}...`)

            // Generate commit message based on settings
            const changes = await getChangedFiles(vaultId, vault.handle)
            const commitMessage = generateCommitMessage(
                changes,
                config.syncSettings.commitMessageStyle,
                config.syncSettings.commitMessageTemplate,
                vault.name
            )

            const result = await syncAll(vaultId, vault.handle, commitMessage)

            if (result.success) {
                console.log(`[GitAutoSync] Successfully synced ${vault.name}`, {
                    pulledFiles: result.pulledFiles,
                    pushedFiles: result.pushedFiles,
                })
            } else {
                console.error(`[GitAutoSync] Sync failed for ${vault.name}:`, result.error)
            }
        } catch (error) {
            console.error(`[GitAutoSync] Error auto syncing ${vault.name}:`, error)
        } finally {
            isAutoSyncRunning.value = false
        }
    }

    /**
     * Start status checking for a vault
     */
    function startStatusCheck(vaultId: string): void {
        // Clear existing interval if any
        stopStatusCheck(vaultId)

        // Do an immediate check
        checkVaultStatus(vaultId)

        // Set up periodic checking
        const intervalId = window.setInterval(() => {
            checkVaultStatus(vaultId)
        }, STATUS_CHECK_INTERVAL)

        statusCheckIntervals.set(vaultId, intervalId)
        console.log(`[GitAutoSync] Started status checking for vault ${vaultId}`)
    }

    /**
     * Stop status checking for a vault
     */
    function stopStatusCheck(vaultId: string): void {
        const intervalId = statusCheckIntervals.get(vaultId)
        if (intervalId) {
            window.clearInterval(intervalId)
            statusCheckIntervals.delete(vaultId)
            console.log(`[GitAutoSync] Stopped status checking for vault ${vaultId}`)
        }
    }

    /**
     * Start remote fetch checking for a vault
     */
    function startRemoteFetch(vaultId: string): void {
        // Clear existing interval if any
        stopRemoteFetch(vaultId)

        // Do an immediate fetch
        fetchRemoteUpdates(vaultId)

        // Set up periodic fetching
        const intervalId = window.setInterval(() => {
            fetchRemoteUpdates(vaultId)
        }, REMOTE_FETCH_INTERVAL)

        remoteFetchIntervals.set(vaultId, intervalId)
        console.log(`[GitAutoSync] Started remote fetch checking for vault ${vaultId} (every ${REMOTE_FETCH_INTERVAL / 60000} minutes)`)
    }

    /**
     * Stop remote fetch checking for a vault
     */
    function stopRemoteFetch(vaultId: string): void {
        const intervalId = remoteFetchIntervals.get(vaultId)
        if (intervalId) {
            window.clearInterval(intervalId)
            remoteFetchIntervals.delete(vaultId)
            console.log(`[GitAutoSync] Stopped remote fetch checking for vault ${vaultId}`)
        }
    }

    /**
     * Start auto sync for a vault
     */
    function startAutoSync(vaultId: string): void {
        const config = gitStore.vaultConfigs[vaultId]
        if (!config?.syncSettings.autoSyncEnabled) {
            return
        }

        // Clear existing interval if any
        stopAutoSync(vaultId)

        // Calculate interval (minimum 1 minute)
        const intervalMs = Math.max(
            MIN_AUTO_SYNC_INTERVAL,
            config.syncSettings.autoSyncInterval * 60 * 1000
        )

        // Set up periodic sync
        const intervalId = window.setInterval(() => {
            autoSyncVault(vaultId)
        }, intervalMs)

        autoSyncIntervals.set(vaultId, intervalId)
        console.log(`[GitAutoSync] Started auto sync for vault ${vaultId} (interval: ${intervalMs / 1000}s)`)
    }

    /**
     * Stop auto sync for a vault
     */
    function stopAutoSync(vaultId: string): void {
        const intervalId = autoSyncIntervals.get(vaultId)
        if (intervalId) {
            window.clearInterval(intervalId)
            autoSyncIntervals.delete(vaultId)
            console.log(`[GitAutoSync] Stopped auto sync for vault ${vaultId}`)
        }
    }

    /**
     * Update auto sync settings for a vault
     * Call this when sync settings change
     */
    function updateAutoSyncSettings(vaultId: string): void {
        const config = gitStore.vaultConfigs[vaultId]

        if (config?.syncSettings.autoSyncEnabled) {
            startAutoSync(vaultId)
        } else {
            stopAutoSync(vaultId)
        }
    }

    /**
     * Start all monitoring for connected vaults
     */
    function startAll(): void {
        if (isStarted) {
            return
        }
        isStarted = true

        const vaults = fileSystemStore.vaults

        for (const vault of vaults) {
            const config = gitStore.vaultConfigs[vault.id]
            if (config?.status.isGitRepo) {
                // Start status checking for all Git repos
                startStatusCheck(vault.id)

                // Start remote fetch checking if has remote
                if (config.status.hasRemote) {
                    startRemoteFetch(vault.id)
                }

                // Start auto sync if enabled
                if (config.syncSettings.autoSyncEnabled) {
                    startAutoSync(vault.id)
                }
            }
        }

        console.log('[GitAutoSync] Started monitoring for all vaults')
    }

    /**
     * Stop all monitoring
     */
    function stopAll(): void {
        for (const vaultId of statusCheckIntervals.keys()) {
            stopStatusCheck(vaultId)
        }
        for (const vaultId of remoteFetchIntervals.keys()) {
            stopRemoteFetch(vaultId)
        }
        for (const vaultId of autoSyncIntervals.keys()) {
            stopAutoSync(vaultId)
        }
        isStarted = false
        console.log('[GitAutoSync] Stopped all monitoring')
    }

    /**
     * Initialize monitoring for a newly connected vault
     */
    function initializeVault(vaultId: string): void {
        const vault = fileSystemStore.vaults.find(v => v.id === vaultId)
        if (!vault) {
            return
        }

        const config = gitStore.vaultConfigs[vaultId]
        if (config?.status.isGitRepo) {
            startStatusCheck(vaultId)

            if (config.status.hasRemote) {
                startRemoteFetch(vaultId)
            }

            if (config.syncSettings.autoSyncEnabled) {
                startAutoSync(vaultId)
            }
        }
    }

    /**
     * Clean up monitoring for a disconnected vault
     */
    function cleanupVault(vaultId: string): void {
        stopStatusCheck(vaultId)
        stopRemoteFetch(vaultId)
        stopAutoSync(vaultId)
    }

    // Watch for vault changes to auto-start/stop monitoring
    watch(
        () => fileSystemStore.vaults.map(v => v.id),
        (newVaultIds, oldVaultIds) => {
            if (!isStarted) return

            // Find newly connected vaults
            for (const vaultId of newVaultIds) {
                if (!oldVaultIds?.includes(vaultId)) {
                    initializeVault(vaultId)
                }
            }

            // Find disconnected vaults
            for (const oldId of (oldVaultIds || [])) {
                if (!newVaultIds.includes(oldId)) {
                    cleanupVault(oldId)
                }
            }
        },
        { deep: true }
    )

    // Watch for Git config changes to update auto sync
    watch(
        () => Object.entries(gitStore.vaultConfigs).map(([id, config]) => ({
            id,
            autoSyncEnabled: config.syncSettings.autoSyncEnabled,
            autoSyncInterval: config.syncSettings.autoSyncInterval,
        })),
        (newConfigs, oldConfigs) => {
            if (!isStarted) return

            for (const config of newConfigs) {
                const oldConfig = oldConfigs?.find(c => c.id === config.id)
                if (
                    oldConfig &&
                    (oldConfig.autoSyncEnabled !== config.autoSyncEnabled ||
                        oldConfig.autoSyncInterval !== config.autoSyncInterval)
                ) {
                    updateAutoSyncSettings(config.id)
                }
            }
        },
        { deep: true }
    )

    return {
        // State
        isAutoSyncRunning,
        lastStatusCheck,
        lastRemoteFetch,

        // Status check methods
        checkVaultStatus,
        checkAllVaultsStatus,
        startStatusCheck,
        stopStatusCheck,

        // Remote fetch methods
        fetchRemoteUpdates,
        startRemoteFetch,
        stopRemoteFetch,

        // Auto sync methods
        autoSyncVault,
        startAutoSync,
        stopAutoSync,
        updateAutoSyncSettings,

        // Global controls
        startAll,
        stopAll,
        initializeVault,
        cleanupVault,
    }
}

