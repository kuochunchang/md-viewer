<template>
  <div class="file-list" :class="{ 'is-dark': isDark }">
    <div class="file-list-header">
      <span class="header-title">FILES</span>
      <v-btn
        icon
        variant="text"
        size="x-small"
        class="add-file-btn"
        title="New File"
        @click="handleAddFile"
      >
        <v-icon size="18">mdi-plus</v-icon>
      </v-btn>
    </div>
    
    <div class="files-container">
      <div
        v-for="file in files"
        :key="file.id"
        class="file-item"
        :class="{ active: file.id === activeTabId }"
        @click="handleFileClick(file.id)"
      >
        <v-icon size="18" class="file-icon">mdi-file-document-outline</v-icon>
        <span class="file-name">{{ file.name }}</span>
        
        <div class="file-actions">
          <v-btn
            icon
            variant="text"
            size="x-small"
            class="delete-file-btn"
            title="Delete File"
            @click.stop="confirmDelete(file.id)"
          >
            <v-icon size="16">mdi-delete-outline</v-icon>
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
import { useTheme } from 'vuetify'
import { useTabsStore } from '../stores/tabsStore'
import ConfirmDialog from './ConfirmDialog.vue'

const tabsStore = useTabsStore()
const theme = useTheme()

const isDark = computed(() => theme.global.name.value === 'dark')
const files = computed(() => tabsStore.tabs)
const activeTabId = computed(() => tabsStore.activeTabId)

const showConfirmDialog = ref(false)
const pendingDeleteId = ref<string | null>(null)

const confirmMessage = computed(() => {
  if (pendingDeleteId.value) {
    const file = files.value.find(f => f.id === pendingDeleteId.value)
    return `Are you sure you want to permanently delete "${file?.name || 'this file'}"? This action cannot be undone.`
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
  background-color: #F3F3F3;
  color: #616161;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;

  &.is-dark {
    background-color: #252526;
    color: #CCCCCC;

    .file-list-header {
      background-color: #252526;
    }

    .file-item {
      &:hover {
        background-color: #2A2D2E;
      }

      &.active {
        background-color: #37373D;
        color: #FFFFFF;
      }
    }
  }
}

.file-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  font-size: 11px;
  font-weight: bold;
  letter-spacing: 0.8px;
  background-color: #F3F3F3;
}

.files-container {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 4px 16px;
  cursor: pointer;
  transition: background-color 0.1s;
  position: relative;
  height: 28px;

  &:hover {
    background-color: #E8E8E8;

    .file-actions {
      display: flex;
    }
  }

  &.active {
    background-color: #E2E2E2;
    color: #333333;
  }

  .file-icon {
    margin-right: 8px;
    opacity: 0.8;
  }

  .file-name {
    flex: 1;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-actions {
    display: none;
    align-items: center;
    gap: 4px;
    margin-right: -8px;
  }
}

.add-file-btn, .delete-file-btn {
  opacity: 0.7;
  &:hover {
    opacity: 1;
  }
}
</style>
