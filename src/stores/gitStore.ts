/**
 * Git Store - Manages Git sync state for all vaults
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
    GitCredentials,
    GitSyncSettings,
    SyncStatus,
    VaultGitConfig,
    VaultGitStatus
} from '../types/git'
import {
    DEFAULT_SYNC_SETTINGS,
    DEFAULT_VAULT_GIT_STATUS,
    GIT_STORAGE_KEYS,
} from '../types/git'

export const useGitStore = defineStore('git', () => {
    // ===== State =====

    /** Global Git credentials (shared across all vaults) */
    const credentials = ref<GitCredentials | null>(null)

    /** Per-vault Git configurations */
    const vaultConfigs = ref<Record<string, VaultGitConfig>>({})

    /** Currently active sync operations */
    const activeSyncs = ref<Set<string>>(new Set())

    // ===== Computed =====

    /** Check if credentials are configured */
    const hasCredentials = computed(() => !!credentials.value?.token)

    /** Get list of vaults with Git enabled */
    const gitEnabledVaults = computed(() => {
        return Object.values(vaultConfigs.value).filter(
            config => config.status.isGitRepo
        )
    })

    /** Check if any vault is currently syncing */
    const isSyncing = computed(() => activeSyncs.value.size > 0)

    // ===== Persistence =====

    /**
     * Load stored Git data from localStorage
     */
    function loadFromStorage(): void {
        try {
            // Load credentials
            const credentialsJson = localStorage.getItem(GIT_STORAGE_KEYS.CREDENTIALS)
            if (credentialsJson) {
                credentials.value = JSON.parse(credentialsJson)
            }

            // Load vault configs
            const configsJson = localStorage.getItem(GIT_STORAGE_KEYS.VAULT_CONFIGS)
            if (configsJson) {
                const configs = JSON.parse(configsJson) as Record<string, VaultGitConfig>
                // Reset runtime status for all vaults
                for (const config of Object.values(configs)) {
                    config.status = { ...DEFAULT_VAULT_GIT_STATUS }
                }
                vaultConfigs.value = configs
            }
        } catch (error) {
            console.error('Failed to load Git data from storage:', error)
        }
    }

    /**
     * Save Git data to localStorage
     */
    function saveToStorage(): void {
        try {
            // Save credentials
            if (credentials.value) {
                localStorage.setItem(
                    GIT_STORAGE_KEYS.CREDENTIALS,
                    JSON.stringify(credentials.value)
                )
            } else {
                localStorage.removeItem(GIT_STORAGE_KEYS.CREDENTIALS)
            }

            // Save vault configs (without runtime status)
            const configsToSave: Record<string, Omit<VaultGitConfig, 'status'>> = {}
            for (const [id, config] of Object.entries(vaultConfigs.value)) {
                const { status: _status, ...rest } = config
                configsToSave[id] = rest as Omit<VaultGitConfig, 'status'>
            }
            localStorage.setItem(
                GIT_STORAGE_KEYS.VAULT_CONFIGS,
                JSON.stringify(configsToSave)
            )
        } catch (error) {
            console.error('Failed to save Git data to storage:', error)
        }
    }

    // ===== Credentials Management =====

    /**
     * Set Git credentials
     */
    function setCredentials(creds: GitCredentials): void {
        credentials.value = creds
        saveToStorage()
    }

    /**
     * Clear Git credentials
     */
    function clearCredentials(): void {
        credentials.value = null
        saveToStorage()
    }

    /**
     * Get current credentials
     */
    function getCredentials(): GitCredentials | null {
        return credentials.value
    }

    // ===== Vault Config Management =====

    /**
     * Get or create config for a vault
     */
    function getVaultConfig(vaultId: string, vaultName: string): VaultGitConfig {
        if (!vaultConfigs.value[vaultId]) {
            vaultConfigs.value[vaultId] = {
                vaultId,
                vaultName,
                remote: null,
                syncSettings: { ...DEFAULT_SYNC_SETTINGS },
                status: { ...DEFAULT_VAULT_GIT_STATUS },
            }
        }
        return vaultConfigs.value[vaultId]
    }

    /**
     * Update vault Git status
     */
    function updateVaultStatus(
        vaultId: string,
        updates: Partial<VaultGitStatus>
    ): void {
        const config = vaultConfigs.value[vaultId]
        if (config) {
            config.status = { ...config.status, ...updates }
        }
    }

    /**
     * Update vault sync settings
     */
    function updateVaultSettings(
        vaultId: string,
        updates: Partial<GitSyncSettings>
    ): void {
        const config = vaultConfigs.value[vaultId]
        if (config) {
            config.syncSettings = { ...config.syncSettings, ...updates }
            saveToStorage()
        }
    }

    /**
     * Set vault remote configuration
     */
    function setVaultRemote(
        vaultId: string,
        url: string,
        name: string = 'origin'
    ): void {
        const config = vaultConfigs.value[vaultId]
        if (config) {
            config.remote = { name, url }
            saveToStorage()
        }
    }

    /**
     * Remove vault config
     */
    function removeVaultConfig(vaultId: string): void {
        delete vaultConfigs.value[vaultId]
        saveToStorage()
    }

    // ===== Sync Status Management =====

    /**
     * Set sync status for a vault
     */
    function setSyncStatus(vaultId: string, status: SyncStatus): void {
        updateVaultStatus(vaultId, { syncStatus: status })

        if (status === 'syncing' || status === 'pulling' || status === 'pushing' || status === 'committing') {
            activeSyncs.value.add(vaultId)
        } else {
            activeSyncs.value.delete(vaultId)
        }
    }

    /**
     * Set error for a vault
     */
    function setError(vaultId: string, error: string | null): void {
        updateVaultStatus(vaultId, {
            errorMessage: error,
            syncStatus: error ? 'error' : 'idle'
        })
        activeSyncs.value.delete(vaultId)
    }

    /**
     * Record successful sync
     */
    function recordSync(vaultId: string): void {
        updateVaultStatus(vaultId, {
            lastSyncTime: Date.now(),
            syncStatus: 'idle',
            errorMessage: null,
        })
        activeSyncs.value.delete(vaultId)
    }

    /**
     * Check if a vault is currently syncing
     */
    function isVaultSyncing(vaultId: string): boolean {
        return activeSyncs.value.has(vaultId)
    }

    // ===== Initialization =====

    /**
     * Initialize the store
     */
    function initialize(): void {
        loadFromStorage()
    }

    return {
        // State
        credentials,
        vaultConfigs,
        activeSyncs,

        // Computed
        hasCredentials,
        gitEnabledVaults,
        isSyncing,

        // Credentials
        setCredentials,
        clearCredentials,
        getCredentials,

        // Vault Config
        getVaultConfig,
        updateVaultStatus,
        updateVaultSettings,
        setVaultRemote,
        removeVaultConfig,

        // Sync Status
        setSyncStatus,
        setError,
        recordSync,
        isVaultSyncing,

        // Lifecycle
        initialize,
        saveToStorage,
        loadFromStorage,
    }
})
