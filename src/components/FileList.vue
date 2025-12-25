<template>
  <div class="file-list">
    <div class="file-list-header">
      <span class="header-title">DOCUMENTS</span>
      <v-tooltip location="bottom" text="New File">
        <template #activator="{ props }">
          <v-btn
            icon
            variant="text"
            size="x-small"
            class="action-btn"
            v-bind="props"
            @click="handleAddFile"
          >
            <v-icon size="18">mdi-plus</v-icon>
          </v-btn>
        </template>
      </v-tooltip>
    </div>
    
    <div class="files-container">
      <div
        v-for="file in files"
        :key="file.id"
        class="file-item"
        :class="{ active: file.id === activeTabId }"
        @click="handleFileClick(file.id)"
      >
        <v-icon size="16" class="file-icon" color="primary">mdi-file-document-outline</v-icon>
        <span class="file-name">{{ file.name }}</span>
        
        <div class="file-actions">
          <v-btn
            icon
            variant="text"
            size="x-small"
            class="delete-btn"
            title="Delete File"
            @click.stop="confirmDelete(file.id)"
          >
            <v-icon size="14">mdi-trash-can-outline</v-icon>
          </v-btn>
        </div>
      </div>
    </div>

    <ConfirmDialog
      v-model="showConfirmDialog"
      title="Delete File"
      :message="confirmMessage"
      @confirm="handleDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTabsStore } from '../stores/tabsStore'
import ConfirmDialog from './ConfirmDialog.vue'

const tabsStore = useTabsStore()

const files = computed(() => tabsStore.tabs)
const activeTabId = computed(() => tabsStore.activeTabId)

const showConfirmDialog = ref(false)
const pendingDeleteId = ref<string | null>(null)

const confirmMessage = computed(() => {
  if (pendingDeleteId.value) {
    const file = files.value.find(f => f.id === pendingDeleteId.value)
    return `Are you sure you want to permanently delete "${file?.name || 'this file'}"?`
  }
  return 'Are you sure you want to delete this file?'
})

function handleAddFile() {
  tabsStore.addTab()
}

function handleFileClick(id: string) {
  tabsStore.openTab(id)
}

function confirmDelete(id: string) {
  pendingDeleteId.value = id
  showConfirmDialog.value = true
}

function handleDelete() {
  if (pendingDeleteId.value) {
    tabsStore.deleteFile(pendingDeleteId.value)
    pendingDeleteId.value = null
  }
}

function cancelDelete() {
  pendingDeleteId.value = null
}
</script>

<style scoped lang="scss">
.file-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.file-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1rem 0.5rem;
  margin-bottom: 0.5rem;
  
  .header-title {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--text-tertiary);
  }
}

.action-btn {
  color: var(--text-tertiary);
  opacity: 0.7;
  border-radius: var(--radius-sm);
  
  &:hover {
    background-color: var(--bg-surface-hover);
    color: var(--text-primary);
    opacity: 1;
  }
}

.files-container {
  flex: 1;
  overflow-y: auto;
  padding: 0 0.5rem;
  
  &::-webkit-scrollbar {
    width: 4px;
  }
}

.file-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  margin-bottom: 2px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.9rem;
  position: relative;
  height: 36px;
  color: var(--text-secondary);

  &:hover {
    background-color: var(--bg-surface-hover);
    color: var(--text-primary);

    .file-actions {
      opacity: 1;
    }
  }

  &.active {
    background-color: var(--bg-surface); // Or a distinct active sidebar color
    color: var(--primary-color);
    font-weight: 500;
    box-shadow: var(--shadow-sm);
    
    .file-icon {
      opacity: 1;
    }
  }

  .file-icon {
    margin-right: 0.75rem;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .file-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: normal;
  }

  .file-actions {
    display: flex;
    align-items: center;
    opacity: 0;
    transition: opacity 0.2s;
    margin-left: 0.5rem;
  }
}

.delete-btn {
  color: var(--text-tertiary);
  height: 24px;
  width: 24px;
  
  &:hover {
    color: #ef4444; // Red
    background-color: rgba(239, 68, 68, 0.1);
  }
}
</style>
