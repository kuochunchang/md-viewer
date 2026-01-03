<template>
  <div class="local-vault-tree">
    <!-- Header -->
    <div class="vault-header">
      <div class="vault-info">
        <v-icon size="18" class="vault-icon">mdi-folder-key-outline</v-icon>
        <span class="vault-name" :title="vaultName">{{ vaultName }}</span>
      </div>
      <div class="vault-actions">
        <v-tooltip location="bottom" text="Refresh">
          <template #activator="{ props }">
            <v-btn
              icon
              variant="text"
              size="x-small"
              class="action-btn"
              :loading="isLoading"
              v-bind="props"
              @click="handleRefresh"
            >
              <v-icon size="16">mdi-refresh</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
        <v-tooltip location="bottom" text="New File">
          <template #activator="{ props }">
            <v-btn
              icon
              variant="text"
              size="x-small"
              class="action-btn"
              v-bind="props"
              @click="handleNewFile"
            >
              <v-icon size="16">mdi-file-plus-outline</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
        <v-tooltip location="bottom" text="Close Vault">
          <template #activator="{ props }">
            <v-btn
              icon
              variant="text"
              size="x-small"
              class="action-btn close-btn"
              v-bind="props"
              @click="handleCloseVault"
            >
              <v-icon size="16">mdi-close</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
      </div>
    </div>

    <!-- File Tree -->
    <div class="vault-contents" v-if="entries.length > 0">
      <LocalFileItem
        v-for="entry in entries"
        :key="entry.path"
        :entry="entry"
        :depth="0"
        @open-file="handleOpenFile"
        @toggle-directory="handleToggleDirectory"
      />
    </div>

    <!-- Empty State -->
    <div v-else-if="!isLoading" class="empty-state">
      <v-icon size="32" color="grey">mdi-folder-open-outline</v-icon>
      <p>No markdown files found</p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <v-progress-circular indeterminate size="24" color="primary" />
      <span>Loading vault...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useFileSystem } from '../composables/useFileSystem'
import { useFileSystemStore } from '../stores/fileSystemStore'
import type { LocalFile } from '../types/fileSystem'
import LocalFileItem from './LocalFileItem.vue'

const emit = defineEmits<{
  (e: 'close-vault'): void
}>()

const fileSystemStore = useFileSystemStore()
const { vaultName, entries, isLoading } = storeToRefs(fileSystemStore)

const {
  openFile,
  createNewFile,
  refreshVault,
  closeVault
} = useFileSystem()

async function handleOpenFile(file: LocalFile) {
  await openFile(file)
}

function handleToggleDirectory(path: string) {
  fileSystemStore.toggleDirectoryExpanded(path)
}

async function handleRefresh() {
  await refreshVault()
}

async function handleNewFile() {
  await createNewFile()
}

function handleCloseVault() {
  closeVault()
  emit('close-vault')
}
</script>

<style scoped>
.local-vault-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: 13px;
}

.vault-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: linear-gradient(
    135deg,
    rgba(99, 102, 241, 0.08) 0%,
    rgba(139, 92, 246, 0.08) 100%
  );
}

.vault-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.vault-icon {
  color: rgb(var(--v-theme-primary));
  flex-shrink: 0;
}

.vault-name {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.9;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vault-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.action-btn {
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.action-btn:hover {
  opacity: 1;
}

.close-btn:hover {
  color: rgb(var(--v-theme-error));
}

.vault-contents {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  gap: 12px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}

.empty-state p {
  margin: 0;
  font-size: 13px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  gap: 12px;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.loading-state span {
  font-size: 13px;
}

/* Scrollbar styling */
.vault-contents::-webkit-scrollbar {
  width: 6px;
}

.vault-contents::-webkit-scrollbar-track {
  background: transparent;
}

.vault-contents::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.15);
  border-radius: 3px;
}

.vault-contents::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-on-surface), 0.25);
}
</style>
