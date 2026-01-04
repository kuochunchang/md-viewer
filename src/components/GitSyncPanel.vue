<template>
  <div class="git-sync-panel">
    <!-- Panel Header -->
    <div class="panel-header" @click="toggleExpanded">
      <div class="header-left">
        <v-icon size="16" class="expand-icon">
          {{ isExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
        </v-icon>
        <v-icon size="18" color="primary">mdi-git</v-icon>
        <span class="header-title">Git Sync</span>
      </div>
      <div class="header-right" @click.stop>
        <v-btn
          v-if="hasAnyGitVaults"
          icon
          variant="text"
          size="x-small"
          title="Git Settings"
          @click="$emit('open-settings')"
        >
          <v-icon size="16">mdi-cog</v-icon>
        </v-btn>
      </div>
    </div>

    <!-- Panel Content -->
    <v-expand-transition>
      <div v-show="isExpanded" class="panel-content">
        <!-- No Credentials Warning -->
        <div v-if="!hasCredentials" class="credentials-warning">
          <v-icon size="24" color="warning">mdi-key-alert</v-icon>
          <p class="warning-text">GitHub token not configured</p>
          <v-btn
            size="small"
            color="primary"
            variant="tonal"
            @click="$emit('open-settings')"
          >
            Configure
          </v-btn>
        </div>

        <!-- Git Enabled Vaults List -->
        <div v-else class="vaults-git-list">
          <!-- Individual Vault Status -->
          <div
            v-for="vault in vaultsWithStatus"
            :key="vault.id"
            class="vault-git-item"
          >
            <div class="vault-info">
              <v-icon size="16" :color="getStatusColor(vault.status)">
                {{ getStatusIcon(vault.status) }}
              </v-icon>
              <span class="vault-name">{{ vault.name }}</span>
            </div>

            <div class="vault-status">
              <!-- Status Text -->
              <span class="status-text" :class="vault.status.syncStatus">
                {{ getStatusText(vault.status) }}
              </span>

              <!-- Sync Button -->
              <v-btn
                v-if="vault.status.isGitRepo && vault.status.hasRemote"
                icon
                variant="text"
                size="x-small"
                :loading="vault.status.syncStatus === 'syncing'"
                :disabled="vault.status.syncStatus !== 'idle'"
                title="Sync"
                @click="handleSync(vault.id)"
              >
                <v-icon size="16">mdi-sync</v-icon>
              </v-btn>

              <!-- Setup Button -->
              <v-btn
                v-else
                icon
                variant="text"
                size="x-small"
                title="Setup Git"
                @click="$emit('setup-vault', vault.id)"
              >
                <v-icon size="16">mdi-cog-outline</v-icon>
              </v-btn>
            </div>
          </div>

          <!-- Obsidian Git Warning -->
          <div v-if="hasObsidianGitVaults" class="obsidian-git-notice">
            <v-icon size="14" color="info">mdi-information</v-icon>
            <span>Some vaults have Obsidian Git installed</span>
          </div>

          <!-- Sync All Button -->
          <div v-if="syncableVaults.length > 1" class="sync-all-section">
            <v-btn
              block
              color="primary"
              variant="tonal"
              size="small"
              :loading="isSyncingAll"
              :disabled="isSyncingAll"
              @click="handleSyncAll"
            >
              <v-icon start size="16">mdi-sync</v-icon>
              Sync All Vaults
            </v-btn>
          </div>

          <!-- No Git Vaults -->
          <div v-if="vaultsWithStatus.length === 0" class="no-vaults">
            <p>No vaults connected</p>
          </div>
        </div>
      </div>
    </v-expand-transition>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useGitSync } from '../composables/useGitSync'
import { useFileSystemStore } from '../stores/fileSystemStore'
import { useGitStore } from '../stores/gitStore'
import type { SyncStatus, VaultGitStatus } from '../types/git'

// Emits
const emit = defineEmits<{
  (e: 'open-settings'): void
  (e: 'setup-vault', vaultId: string): void
  (e: 'sync-complete', vaultId: string, success: boolean): void
}>()

// Stores
const gitStore = useGitStore()
const fileSystemStore = useFileSystemStore()
const gitSync = useGitSync()

const { hasCredentials, vaultConfigs } = storeToRefs(gitStore)
const { vaults } = storeToRefs(fileSystemStore)

// State
const isExpanded = ref(true)
const isSyncingAll = ref(false)

// Computed
const vaultsWithStatus = computed(() => {
  return vaults.value.map(vault => {
    const gitConfig = vaultConfigs.value[vault.id]
    return {
      id: vault.id,
      name: vault.name,
      handle: vault.handle,
      status: gitConfig?.status || {
        isGitRepo: false,
        hasRemote: false,
        currentBranch: null,
        changedFilesCount: 0,
        hasUnpushedCommits: false,
        lastSyncTime: null,
        syncStatus: 'idle' as SyncStatus,
        errorMessage: null,
        hasObsidianGit: false,
      },
    }
  })
})

const hasAnyGitVaults = computed(() => {
  return vaultsWithStatus.value.some(v => v.status.isGitRepo)
})

const hasObsidianGitVaults = computed(() => {
  return vaultsWithStatus.value.some(v => v.status.hasObsidianGit)
})

const syncableVaults = computed(() => {
  return vaultsWithStatus.value.filter(
    v => v.status.isGitRepo && v.status.hasRemote
  )
})

// Methods
function toggleExpanded() {
  isExpanded.value = !isExpanded.value
}

function getStatusIcon(status: VaultGitStatus): string {
  if (!status.isGitRepo) return 'mdi-git'
  if (status.syncStatus === 'error' || status.syncStatus === 'conflict') {
    return 'mdi-alert-circle'
  }
  if (status.syncStatus === 'syncing' || status.syncStatus === 'pulling' || 
      status.syncStatus === 'pushing' || status.syncStatus === 'committing') {
    return 'mdi-sync'
  }
  if (status.changedFilesCount > 0 || status.hasUnpushedCommits) {
    return 'mdi-source-branch-sync'
  }
  return 'mdi-check-circle'
}

function getStatusColor(status: VaultGitStatus): string {
  if (!status.isGitRepo) return 'grey'
  if (status.syncStatus === 'error') return 'error'
  if (status.syncStatus === 'conflict') return 'warning'
  if (status.changedFilesCount > 0 || status.hasUnpushedCommits) {
    return 'info'
  }
  return 'success'
}

function getStatusText(status: VaultGitStatus): string {
  if (!status.isGitRepo) return 'Not initialized'
  if (!status.hasRemote) return 'No remote'
  
  switch (status.syncStatus) {
    case 'syncing': return 'Syncing...'
    case 'pulling': return 'Pulling...'
    case 'pushing': return 'Pushing...'
    case 'committing': return 'Committing...'
    case 'error': return status.errorMessage || 'Error'
    case 'conflict': return 'Conflicts'
    case 'idle':
      if (status.changedFilesCount > 0) {
        return `${status.changedFilesCount} changes`
      }
      if (status.hasUnpushedCommits) {
        return 'Unpushed commits'
      }
      return 'Up to date'
    default:
      return 'Unknown'
  }
}

async function handleSync(vaultId: string) {
  const vault = vaultsWithStatus.value.find(v => v.id === vaultId)
  if (!vault || !vault.handle) return

  const changes = await gitSync.getChangedFiles(vaultId, vault.handle)
  const message = gitSync.generateCommitMessage(
    changes,
    gitStore.vaultConfigs[vaultId]?.syncSettings.commitMessageStyle || 'smart',
    gitStore.vaultConfigs[vaultId]?.syncSettings.commitMessageTemplate,
    vault.name
  )

  const result = await gitSync.syncAll(vaultId, vault.handle, message)
  emit('sync-complete', vaultId, result.success)
}

async function handleSyncAll() {
  isSyncingAll.value = true
  
  for (const vault of syncableVaults.value) {
    if (vault.handle) {
      await handleSync(vault.id)
    }
  }
  
  isSyncingAll.value = false
}
</script>

<style scoped>
.git-sync-panel {
  border-top: 1px solid rgba(var(--v-border-color), 0.12);
  background: rgba(var(--v-theme-surface), 0.5);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
}

.panel-header:hover {
  background: rgba(var(--v-theme-primary), 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.expand-icon {
  transition: transform 0.2s;
}

.header-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.panel-content {
  padding: 8px 12px 12px;
}

.credentials-warning {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  text-align: center;
  background: rgba(var(--v-theme-warning), 0.08);
  border-radius: 8px;
}

.warning-text {
  margin: 0;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.vaults-git-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vault-git-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border-radius: 6px;
}

.vault-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.vault-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vault-status {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-text {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.status-text.error {
  color: rgb(var(--v-theme-error));
}

.status-text.conflict {
  color: rgb(var(--v-theme-warning));
}

.status-text.syncing,
.status-text.pulling,
.status-text.pushing,
.status-text.committing {
  color: rgb(var(--v-theme-info));
}

.obsidian-git-notice {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  background: rgba(var(--v-theme-info), 0.08);
  border-radius: 4px;
}

.sync-all-section {
  margin-top: 8px;
}

.no-vaults {
  padding: 16px;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), 0.5);
  font-size: 12px;
}
</style>
