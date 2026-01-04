/**
 * Git Sync Types
 * Type definitions for Git synchronization functionality
 */

/**
 * Git credentials for authentication
 */
export interface GitCredentials {
    /** GitHub Personal Access Token */
    token: string
    /** Git user name (for commit author) */
    userName: string
    /** Git user email (for commit author) */
    userEmail: string
}

/**
 * Git remote configuration
 */
export interface GitRemoteConfig {
    /** Remote name, default "origin" */
    name: string
    /** Remote URL, e.g., https://github.com/user/vault.git */
    url: string
}

/**
 * Commit message style options
 */
export type CommitMessageStyle = 'ai' | 'smart' | 'timestamp' | 'custom'

/**
 * Obsidian Git coexistence mode
 */
export type ObsidianGitMode = 'auto' | 'full' | 'pull-only'

/**
 * Git sync settings for a vault
 */
export interface GitSyncSettings {
    /** Enable auto sync (default: false) */
    autoSyncEnabled: boolean
    /** Auto sync interval in minutes (default: 5) */
    autoSyncInterval: number
    /** Auto pull on startup (default: false) */
    autoPullOnStartup: boolean
    /** Commit message style */
    commitMessageStyle: CommitMessageStyle
    /** Custom commit message template (used when style is 'custom') */
    commitMessageTemplate: string
    /** Obsidian Git coexistence mode */
    obsidianGitMode: ObsidianGitMode
}

/**
 * Default sync settings
 */
export const DEFAULT_SYNC_SETTINGS: GitSyncSettings = {
    autoSyncEnabled: false,
    autoSyncInterval: 5,
    autoPullOnStartup: false,
    commitMessageStyle: 'smart',
    commitMessageTemplate: 'vault backup: {{date}}',
    obsidianGitMode: 'auto',
}

/**
 * Git sync status
 */
export type SyncStatus = 'idle' | 'syncing' | 'pulling' | 'pushing' | 'committing' | 'error' | 'conflict'

/**
 * Vault Git status
 */
export interface VaultGitStatus {
    /** Is this a Git repository */
    isGitRepo: boolean
    /** Has remote configured */
    hasRemote: boolean
    /** Current branch name */
    currentBranch: string | null
    /** Number of changed files */
    changedFilesCount: number
    /** Has unpushed commits */
    hasUnpushedCommits: boolean
    /** Last sync timestamp */
    lastSyncTime: number | null
    /** Current sync status */
    syncStatus: SyncStatus
    /** Error message if any */
    errorMessage: string | null
    /** Is Obsidian Git plugin detected */
    hasObsidianGit: boolean
}

/**
 * Default vault Git status
 */
export const DEFAULT_VAULT_GIT_STATUS: VaultGitStatus = {
    isGitRepo: false,
    hasRemote: false,
    currentBranch: null,
    changedFilesCount: 0,
    hasUnpushedCommits: false,
    lastSyncTime: null,
    syncStatus: 'idle',
    errorMessage: null,
    hasObsidianGit: false,
}

/**
 * Vault Git configuration
 */
export interface VaultGitConfig {
    /** Vault ID */
    vaultId: string
    /** Vault name */
    vaultName: string
    /** Remote configuration */
    remote: GitRemoteConfig | null
    /** Sync settings */
    syncSettings: GitSyncSettings
    /** Current status */
    status: VaultGitStatus
}

/**
 * File change status
 */
export type FileChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed'

/**
 * File change information
 */
export interface FileChange {
    /** File path relative to vault root */
    path: string
    /** File name without path */
    name: string
    /** Change status */
    status: FileChangeStatus
    /** Diff content (optional, may be truncated) */
    diff?: string
}

/**
 * Sync result
 */
export interface SyncResult {
    /** Was the sync successful */
    success: boolean
    /** Number of files pulled */
    pulledFiles: number
    /** Number of files pushed */
    pushedFiles: number
    /** Commit hash if committed */
    commitHash?: string
    /** Error message if failed */
    error?: string
    /** Has conflicts that need resolution */
    hasConflicts: boolean
    /** Conflict file paths */
    conflictFiles: string[]
}

/**
 * Pull result
 */
export interface PullResult {
    /** Was the pull successful */
    success: boolean
    /** Number of files updated */
    updatedFiles: number
    /** Was fast-forward merge */
    fastForward: boolean
    /** Error message if failed */
    error?: string
    /** Has conflicts */
    hasConflicts: boolean
    /** Conflict file paths */
    conflictFiles: string[]
}

/**
 * Push result
 */
export interface PushResult {
    /** Was the push successful */
    success: boolean
    /** Number of commits pushed */
    commitsPushed: number
    /** Error message if failed */
    error?: string
}

/**
 * localStorage storage keys
 */
export const GIT_STORAGE_KEYS = {
    /** Global Git credentials (shared across vaults) */
    CREDENTIALS: 'md-viewer-git-credentials',
    /** Per-vault Git configurations */
    VAULT_CONFIGS: 'md-viewer-vault-git-configs',
} as const

/**
 * Stored Git data structure
 */
export interface StoredGitData {
    /** Global credentials */
    credentials: GitCredentials | null
    /** Vault configurations by vault ID */
    vaultConfigs: Record<string, VaultGitConfig>
}
