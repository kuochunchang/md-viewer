<template>
  <div class="folder-tree">
    <!-- Folder header -->
    <div
      class="folder-header"
      :class="{ 
        expanded: folder.expanded, 
        dragging: isDragging,
        'drag-over': isDragOver && canDrop
      }"
      draggable="true"
      @click="toggleExpanded"
      @contextmenu.prevent="showContextMenu"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <v-icon size="14" class="expand-icon">
        {{ folder.expanded ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
      </v-icon>
      <v-icon size="16" class="folder-icon" color="primary">
        {{ folder.expanded ? 'mdi-folder-open-outline' : 'mdi-folder-outline' }}
      </v-icon>
      
      <!-- Folder name (editable) -->
      <input
        v-if="isEditingFolder"
        ref="nameInputRef"
        v-model="editingName"
        class="folder-name-input"
        @blur="finishEditingFolder"
        @keydown.enter="finishEditingFolder"
        @keydown.escape="cancelEditingFolder"
        @click.stop
      />
      <span 
        v-else 
        class="folder-name" 
        @dblclick.stop="startEditingFolder"
      >{{ folder.name }}</span>

      <div class="folder-actions">
        <v-btn
          icon
          variant="text"
          size="x-small"
          class="action-btn"
          title="Add Document"
          @click.stop="addFileToFolder"
        >
          <v-icon size="14">mdi-file-plus-outline</v-icon>
        </v-btn>
        <v-btn
          icon
          variant="text"
          size="x-small"
          class="action-btn"
          title="Add Subfolder"
          @click.stop="addSubfolder"
        >
          <v-icon size="14">mdi-folder-plus-outline</v-icon>
        </v-btn>
        <v-btn
          icon
          variant="text"
          size="x-small"
          class="delete-btn"
          title="Delete Folder"
          @click.stop="handleDelete"
        >
          <v-icon size="14">mdi-trash-can-outline</v-icon>
        </v-btn>
      </div>
    </div>

    <!-- Folder contents (expandable) -->
    <div v-show="folder.expanded" class="folder-contents">
      <!-- Child folders -->
      <FolderTree
        v-for="childFolder in childFolders"
        :key="childFolder.id"
        :folder="childFolder"
        :depth="depth + 1"
        @delete="$emit('delete', $event)"
        @delete-file="$emit('deleteFile', $event)"
      />

      <!-- Files in this folder -->
      <div
        v-for="file in filesInFolder"
        :key="file.id"
        class="file-item"
        :class="{ 
          active: file.id === activeTabId,
          dragging: draggingFileId === file.id
        }"
        :style="{ paddingLeft: `${(depth + 1) * 10 + 10}px` }"
        draggable="true"
        @click="handleFileClick(file.id)"
        @dragstart="handleFileDragStart($event, file.id)"
        @dragend="handleFileDragEnd"
      >
        <v-icon size="16" class="file-icon" color="primary">mdi-file-document-outline</v-icon>
        
        <!-- File name (editable) -->
        <input
          v-if="tabsStore.isEditing(file.id)"
          ref="fileNameInputRef"
          v-model="editingFileName"
          class="file-name-input"
          @blur="finishFileEditing"
          @keydown.enter="finishFileEditing"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useTabsStore } from '../stores/tabsStore'
import type { Folder } from '../types'

const props = defineProps<{
  folder: Folder
  depth?: number
}>()

const emit = defineEmits<{
  delete: [id: string]
  deleteFile: [id: string]
}>()

const tabsStore = useTabsStore()

const depth = computed(() => props.depth ?? 0)
const activeTabId = computed(() => tabsStore.activeTabId)

const childFolders = computed(() => tabsStore.getChildFolders(props.folder.id))
const filesInFolder = computed(() => tabsStore.getTabsInFolder(props.folder.id))

// Editing state - uses global store state
const isEditingFolder = computed(() => tabsStore.isEditing(props.folder.id))
const editingName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

// File editing - uses global store state
const editingFileName = ref('')
const fileNameInputRef = ref<HTMLInputElement | null>(null)

// Drag state
const isDragging = ref(false)
const isDragOver = ref(false)
const canDrop = ref(false)
const draggingFileId = ref<string | null>(null)

function toggleExpanded() {
  tabsStore.toggleFolderExpanded(props.folder.id)
}

function startEditingFolder() {
  tabsStore.startEditing(props.folder.id, 'folder')
  editingName.value = props.folder.name
  nextTick(() => {
    nameInputRef.value?.focus()
    nameInputRef.value?.select()
  })
}

function finishEditingFolder() {
  if (editingName.value.trim()) {
    tabsStore.renameFolder(props.folder.id, editingName.value)
  }
  tabsStore.stopEditing()
}

function cancelEditingFolder() {
  tabsStore.stopEditing()
}

// File editing functions
function startFileEditing(file: { id: string; name: string }) {
  tabsStore.startEditing(file.id, 'file')
  editingFileName.value = file.name
  nextTick(() => {
    fileNameInputRef.value?.focus()
    fileNameInputRef.value?.select()
  })
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

function addFileToFolder() {
  tabsStore.addTab(undefined, props.folder.id)
}

function addSubfolder() {
  tabsStore.addFolder(undefined, props.folder.id)
}

function handleDelete() {
  emit('delete', props.folder.id)
}

function handleFileClick(id: string) {
  tabsStore.openTab(id)
}

function confirmDeleteFile(id: string) {
  emit('deleteFile', id)
}

function showContextMenu(event: MouseEvent) {
  // TODO: Implement context menu if needed
  console.log('Context menu at', event.clientX, event.clientY)
}

// Folder drag handlers
function handleDragStart(event: DragEvent) {
  isDragging.value = true
  event.dataTransfer!.effectAllowed = 'move'
  event.dataTransfer!.setData('application/json', JSON.stringify({
    type: 'folder',
    id: props.folder.id
  }))
  // Add a class to the body for global styling
  document.body.classList.add('is-dragging')
}

function handleDragEnd() {
  isDragging.value = false
  document.body.classList.remove('is-dragging')
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = true
  
  try {
    // Check if we can accept this drop
    const types = event.dataTransfer?.types || []
    if (types.includes('application/json')) {
      canDrop.value = true
      event.dataTransfer!.dropEffect = 'move'
    }
  } catch {
    canDrop.value = false
  }
}

function handleDragLeave() {
  isDragOver.value = false
  canDrop.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  isDragOver.value = false
  canDrop.value = false
  
  try {
    const data = JSON.parse(event.dataTransfer!.getData('application/json'))
    
    if (data.type === 'file') {
      // Move file to this folder
      tabsStore.moveTabToFolder(data.id, props.folder.id)
    } else if (data.type === 'folder') {
      // Move folder to this folder (as child)
      if (data.id !== props.folder.id) {
        tabsStore.moveFolderToFolder(data.id, props.folder.id)
      }
    }
  } catch (e) {
    console.error('Drop error:', e)
  }
}

// File drag handlers
function handleFileDragStart(event: DragEvent, fileId: string) {
  event.stopPropagation()
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
.folder-tree {
  user-select: none;
}

.folder-header {
  display: flex;
  align-items: center;
  padding: 1px 4px;
  padding-left: calc(v-bind('depth * 10') * 1px + 4px);
  margin-bottom: 0;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.1s ease;
  font-size: 13px;
  color: var(--text-secondary);
  min-height: 24px;
  line-height: 1.2;

  &:hover {
    background-color: var(--bg-surface-hover);
    color: var(--text-primary);

    .folder-actions {
      opacity: 1;
    }
  }

  &.expanded {
    .expand-icon {
      transform: rotate(0deg);
    }
  }

  &.dragging {
    opacity: 0.5;
    background-color: var(--bg-surface-hover);
  }

  &.drag-over {
    background-color: rgba(var(--primary-rgb), 0.15);
    border: 2px dashed var(--primary-color);
    border-radius: var(--radius-sm);
  }
}

.expand-icon {
  margin-right: 2px;
  opacity: 0.6;
  flex-shrink: 0;
  font-size: 12px !important;
  width: 12px !important;
  height: 12px !important;
}

.folder-icon {
  margin-right: 4px;
  opacity: 0.85;
  flex-shrink: 0;
  font-size: 14px !important;
  width: 14px !important;
  height: 14px !important;
}

.folder-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.folder-name-input {
  flex: 1;
  background: var(--bg-surface);
  border: 1px solid var(--primary-color);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  font-size: inherit;
  color: var(--text-primary);
  outline: none;
  min-width: 0;

  &:focus {
    box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.2);
  }
}

.folder-actions {
  display: flex;
  align-items: center;
  opacity: 0;
  transition: opacity 0.2s;
  margin-left: auto;
  gap: 2px;
}

.action-btn {
  color: var(--text-tertiary);
  height: 16px !important;
  width: 16px !important;
  min-width: 16px !important;
  
  :deep(.v-icon) {
    font-size: 12px !important;
  }
  
  &:hover {
    color: var(--text-primary);
    background-color: var(--bg-surface-hover);
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

.folder-contents {
  // Nested content
}

.file-item {
  display: flex;
  align-items: center;
  padding: 1px 4px;
  margin-bottom: 0;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.1s ease;
  font-size: 13px;
  color: var(--text-secondary);
  min-height: 24px;
  line-height: 1.2;

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
}

.file-icon {
  margin-right: 0.5rem;
  opacity: 0.7;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.file-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: default;
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
</style>
