<template>
  <div class="file-list">
    <div class="file-list-header">
      <span class="header-title">DOCUMENTS</span>
      <div class="header-actions">
        <v-tooltip location="bottom" text="Download as ZIP">
          <template #activator="{ props }">
            <v-btn
              icon
              variant="text"
              size="x-small"
              class="action-btn"
              :loading="isDownloading"
              :disabled="isDownloading"
              v-bind="props"
              @click="handleDownloadZip"
            >
              <v-icon size="18">mdi-download</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
        <v-tooltip location="bottom" text="New Folder">
          <template #activator="{ props }">
            <v-btn
              icon
              variant="text"
              size="x-small"
              class="action-btn"
              v-bind="props"
              @click="handleAddFolder"
            >
              <v-icon size="18">mdi-folder-plus-outline</v-icon>
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
              @click="handleAddFile"
            >
              <v-icon size="18">mdi-plus</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
      </div>
    </div>
    
    <div 
      class="files-container"
      :class="{ 'drag-over-root': isDragOverRoot }"
      @dragover="handleRootDragOver"
      @dragleave="handleRootDragLeave"
      @drop="handleRootDrop"
    >
      <!-- Root level folders -->
      <FolderTree
        v-for="folder in rootFolders"
        :key="folder.id"
        :folder="folder"
        :depth="0"
        @delete="confirmDeleteFolder"
        @delete-file="confirmDeleteFile"
      />

      <!-- Root level files (not in any folder) -->
      <div
        v-for="file in rootFiles"
        :key="file.id"
        class="file-item"
        :class="{ 
          active: file.id === activeTabId,
          dragging: draggingFileId === file.id
        }"
        draggable="true"
        @click="handleFileClick(file.id)"
        @dragstart="handleFileDragStart($event, file.id)"
        @dragend="handleFileDragEnd"
      >
        <v-icon size="16" class="file-icon" color="primary">mdi-file-document-outline</v-icon>
        
        <!-- File name (editable) -->
        <input
          v-if="tabsStore.isEditing(file.id)"
          :ref="(el) => setFileInputRef(file.id, el as HTMLInputElement | null)"
          v-model="editingFileName"
          class="file-name-input"
          @blur="finishFileEditing"
          @keydown.enter="handleFileKeydown"
          @keydown.escape="cancelFileEditing"
          @click.stop
        />
        <span 
          v-else 
          class="file-name" 
          @dblclick.stop="startFileEditing(file)"
        >{{ file.name }}</span>
        
        <div class="file-actions">
          <v-btn
            icon
            variant="text"
            size="x-small"
            class="delete-btn"
            title="Delete File"
            @click.stop="confirmDeleteFile(file.id)"
          >
            <v-icon size="14">mdi-trash-can-outline</v-icon>
          </v-btn>
        </div>
      </div>

      <!-- Drop zone indicator for moving to root -->
      <div 
        v-if="isDragOverRoot" 
        class="root-drop-indicator"
      >
        <v-icon size="16">mdi-folder-arrow-down-outline</v-icon>
        <span>Move to root</span>
      </div>
    </div>

    <!-- Delete File Confirmation Dialog -->
    <ConfirmDialog
      v-model="showDeleteFileDialog"
      title="Delete File"
      :message="deleteFileMessage"
      @confirm="handleDeleteFile"
      @cancel="cancelDeleteFile"
    />

    <!-- Delete Folder Confirmation Dialog -->
    <ConfirmDialog
      v-model="showDeleteFolderDialog"
      title="Delete Folder"
      :message="deleteFolderMessage"
      @confirm="handleDeleteFolder"
      @cancel="cancelDeleteFolder"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useTabsStore } from '../stores/tabsStore'
import { useZipDownload } from '../composables/useZipDownload'
import ConfirmDialog from './ConfirmDialog.vue'
import FolderTree from './FolderTree.vue'

const tabsStore = useTabsStore()
const { isDownloading, downloadAsZip } = useZipDownload()

const rootFolders = computed(() => tabsStore.rootFolders)
const rootFiles = computed(() => tabsStore.rootTabs)
const activeTabId = computed(() => tabsStore.activeTabId)

// Delete file state
const showDeleteFileDialog = ref(false)
const pendingDeleteFileId = ref<string | null>(null)

const deleteFileMessage = computed(() => {
  if (pendingDeleteFileId.value) {
    const file = tabsStore.tabs.find(f => f.id === pendingDeleteFileId.value)
    return `Are you sure you want to permanently delete "${file?.name || 'this file'}"?`
  }
  return 'Are you sure you want to delete this file?'
})

// Delete folder state
const showDeleteFolderDialog = ref(false)
const pendingDeleteFolderId = ref<string | null>(null)

const deleteFolderMessage = computed(() => {
  if (pendingDeleteFolderId.value) {
    const folder = tabsStore.folders.find(f => f.id === pendingDeleteFolderId.value)
    const filesInFolder = tabsStore.getTabsInFolder(pendingDeleteFolderId.value)
    const childFolders = tabsStore.getChildFolders(pendingDeleteFolderId.value)
    
    let message = `Are you sure you want to delete the folder "${folder?.name || 'this folder'}"?`
    if (filesInFolder.length > 0 || childFolders.length > 0) {
      message += `\n\nThe folder contains ${filesInFolder.length} file(s) and ${childFolders.length} subfolder(s). They will be moved to the root level.`
    }
    return message
  }
  return 'Are you sure you want to delete this folder?'
})

// Drag state
const isDragOverRoot = ref(false)
const draggingFileId = ref<string | null>(null)
let dragOverTimeout: ReturnType<typeof setTimeout> | null = null

// File editing state - uses global store state
const editingFileName = ref('')
const fileInputRefs = ref<Map<string, HTMLInputElement | null>>(new Map())

function setFileInputRef(id: string, el: HTMLInputElement | null) {
  if (el) {
    fileInputRefs.value.set(id, el)
  } else {
    fileInputRefs.value.delete(id)
  }
}

function startFileEditing(file: { id: string; name: string }) {
  tabsStore.startEditing(file.id, 'file')
  editingFileName.value = file.name
  // Double nextTick to ensure DOM is fully rendered and ref is set
  nextTick(() => {
    nextTick(() => {
      const inputEl = fileInputRefs.value.get(file.id)
      if (inputEl) {
        inputEl.focus()
        inputEl.select()
      }
    })
  })
}

function handleFileKeydown(event: KeyboardEvent) {
  // Ignore Enter during IME composition (e.g., Chinese input)
  if (event.isComposing) return
  finishFileEditing()
}

function finishFileEditing() {
  const editingId = tabsStore.editingItemId
  if (editingId && editingFileName.value.trim()) {
    tabsStore.renameTab(editingId, editingFileName.value)
  }
  tabsStore.stopEditing()
}

function cancelFileEditing() {
  tabsStore.stopEditing()
}

function handleAddFile() {
  tabsStore.addTab()
}

function handleAddFolder() {
  tabsStore.addFolder()
}

async function handleDownloadZip() {
  try {
    await downloadAsZip()
  } catch (error) {
    console.error('Download failed:', error)
  }
}

function handleFileClick(id: string) {
  tabsStore.openTab(id)
}

// File deletion
function confirmDeleteFile(id: string) {
  pendingDeleteFileId.value = id
  showDeleteFileDialog.value = true
}

function handleDeleteFile() {
  if (pendingDeleteFileId.value) {
    tabsStore.deleteFile(pendingDeleteFileId.value)
    pendingDeleteFileId.value = null
  }
}

function cancelDeleteFile() {
  pendingDeleteFileId.value = null
}

// Folder deletion
function confirmDeleteFolder(id: string) {
  pendingDeleteFolderId.value = id
  showDeleteFolderDialog.value = true
}

function handleDeleteFolder() {
  if (pendingDeleteFolderId.value) {
    tabsStore.deleteFolder(pendingDeleteFolderId.value)
    pendingDeleteFolderId.value = null
  }
}

function cancelDeleteFolder() {
  pendingDeleteFolderId.value = null
}

// Root level drag handlers
function handleRootDragOver(event: DragEvent) {
  event.preventDefault()
  
  // Clear any existing timeout
  if (dragOverTimeout) {
    clearTimeout(dragOverTimeout)
  }
  
  // Only show drop zone if dragging over the empty area (not over items)
  const target = event.target as HTMLElement
  if (target.classList.contains('files-container') || target.classList.contains('root-drop-indicator')) {
    isDragOverRoot.value = true
    event.dataTransfer!.dropEffect = 'move'
  }
}

function handleRootDragLeave(event: DragEvent) {
  // Use a small timeout to prevent flickering when moving between elements
  dragOverTimeout = setTimeout(() => {
    const relatedTarget = event.relatedTarget as HTMLElement
    const container = (event.currentTarget as HTMLElement)
    
    if (!relatedTarget || !container.contains(relatedTarget)) {
      isDragOverRoot.value = false
    }
  }, 50)
}

function handleRootDrop(event: DragEvent) {
  event.preventDefault()
  isDragOverRoot.value = false
  
  // Only handle if dropped in the container area (not on a specific folder)
  const target = event.target as HTMLElement
  if (!target.classList.contains('files-container') && !target.classList.contains('root-drop-indicator')) {
    return
  }
  
  try {
    const data = JSON.parse(event.dataTransfer!.getData('application/json'))
    
    if (data.type === 'file') {
      // Move file to root
      tabsStore.moveTabToFolder(data.id, null)
    } else if (data.type === 'folder') {
      // Move folder to root
      tabsStore.moveFolderToFolder(data.id, null)
    }
  } catch (e) {
    console.error('Drop error:', e)
  }
}

// File drag handlers for root level files
function handleFileDragStart(event: DragEvent, fileId: string) {
  draggingFileId.value = fileId
  event.dataTransfer!.effectAllowed = 'move'
  event.dataTransfer!.setData('application/json', JSON.stringify({
    type: 'file',
    id: fileId
  }))
  document.body.classList.add('is-dragging')
}

function handleFileDragEnd() {
  draggingFileId.value = null
  document.body.classList.remove('is-dragging')
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
  padding: 6px 8px 4px;
  margin-bottom: 2px;
  
  .header-title {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--text-tertiary);
  }

  .header-actions {
    display: flex;
    gap: 4px;
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
  padding: 0 3px;
  position: relative;
  
  &::-webkit-scrollbar {
    width: 3px;
  }

  &.drag-over-root {
    background-color: rgba(var(--primary-rgb), 0.05);
  }
}

.root-drop-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  margin-top: 8px;
  border: 2px dashed var(--primary-color);
  border-radius: var(--radius-sm);
  background-color: rgba(var(--primary-rgb), 0.1);
  color: var(--primary-color);
  font-size: 0.85rem;
  opacity: 0.8;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 1px 4px;
  padding-left: 14px;
  margin-bottom: 0;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.1s ease;
  font-size: 13px;
  position: relative;
  min-height: 24px;
  line-height: 1.2;
  color: var(--text-secondary);

  &:hover {
    background-color: var(--bg-surface-hover);
    color: var(--text-primary);

    .file-actions {
      opacity: 1;
    }
  }

  &.active {
    background-color: var(--bg-surface);
    color: var(--primary-color);
    font-weight: 500;
    box-shadow: var(--shadow-sm);
    
    .file-icon {
      opacity: 1;
    }
  }

  &.dragging {
    opacity: 0.5;
    background-color: var(--bg-surface-hover);
  }

  .file-icon {
    margin-right: 4px;
    opacity: 0.7;
    flex-shrink: 0;
    font-size: 14px !important;
    width: 14px !important;
    height: 14px !important;
  }

  .file-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: normal;
    cursor: pointer;
  }

  .file-name-input {
    flex: 1;
    background: var(--bg-surface);
    border: 1px solid var(--primary-color);
    border-radius: 3px;
    padding: 1px 4px;
    font-size: inherit;
    color: var(--text-primary);
    outline: none;
    min-width: 0;

    &:focus {
      box-shadow: 0 0 0 1px rgba(var(--primary-rgb), 0.2);
    }
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
  height: 16px !important;
  width: 16px !important;
  min-width: 16px !important;
  
  :deep(.v-icon) {
    font-size: 12px !important;
  }
  
  &:hover {
    color: #ef4444;
    background-color: rgba(239, 68, 68, 0.1);
  }
}
</style>

<style>
/* Global styles for drag state */
body.is-dragging {
  cursor: grabbing !important;
  user-select: none;
}

body.is-dragging * {
  cursor: grabbing !important;
}
</style>
