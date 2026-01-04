<template>
  <div class="local-file-item">
    <!-- Directory -->
    <template v-if="entry.kind === 'directory'">
      <div 
        class="item-row directory-row"
        :class="{ expanded: entry.expanded, 'drop-target': isDropTarget, 'dragging': isDragging }"
        :style="{ paddingLeft: `${depth * 12 + 8}px` }"
        draggable="true"
        @click="handleToggleDirectory"
        @contextmenu.prevent="showContextMenu"
        @dragstart="handleDragStart"
        @dragend="handleDragEnd"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
      >
        <v-icon size="14" class="expand-icon">
          {{ entry.expanded ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
        </v-icon>
        <v-icon size="16" class="folder-icon">
          {{ entry.expanded ? 'mdi-folder-open' : 'mdi-folder' }}
        </v-icon>
        
        <!-- Rename input -->
        <input
          v-if="isRenaming"
          ref="renameInput"
          v-model="newName"
          class="rename-input"
          @keydown.enter="confirmRename"
          @keydown.escape="cancelRename"
          @blur="confirmRename"
          @click.stop
        />
        <span v-else class="item-name" :title="entry.name">{{ entry.name }}</span>
        
        <span class="item-count">{{ getFileCount(entry) }}</span>
        
        <!-- Hover actions -->
        <div class="item-actions" @click.stop>
          <v-btn
            icon
            variant="text"
            size="x-small"
            title="New File"
            @click="handleNewFile"
          >
            <v-icon size="12">mdi-file-plus-outline</v-icon>
          </v-btn>
          <v-btn
            icon
            variant="text"
            size="x-small"
            title="New Folder"
            @click="handleNewFolder"
          >
            <v-icon size="12">mdi-folder-plus-outline</v-icon>
          </v-btn>
          <v-btn
            icon
            variant="text"
            size="x-small"
            title="More Actions"
            @click.stop="showContextMenu"
          >
            <v-icon size="12">mdi-dots-horizontal</v-icon>
          </v-btn>
        </div>
      </div>

      <!-- Children -->
      <div v-show="entry.expanded" class="directory-children">
        <LocalFileItem
          v-for="child in entry.children"
          :key="child.path"
          :entry="child"
          :vault-id="vaultId"
          :depth="depth + 1"
          @open-file="(file, vid) => $emit('open-file', file, vid)"
          @toggle-directory="(vid, path) => $emit('toggle-directory', vid, path)"
          @create-file="(vid, path) => $emit('create-file', vid, path)"
          @create-folder="(vid, path) => $emit('create-folder', vid, path)"
          @rename="(vid, path, kind, newName) => $emit('rename', vid, path, kind, newName)"
          @delete="(vid, path, kind) => $emit('delete', vid, path, kind)"
          @move="(vid, source, target, kind) => $emit('move', vid, source, target, kind)"
        />
      </div>
    </template>

    <!-- File -->
    <template v-else>
      <div 
        class="item-row file-row"
        :class="{ 'dragging': isDragging }"
        :style="{ paddingLeft: `${depth * 12 + 22}px` }"
        draggable="true"
        @click="handleOpenFile"
        @dblclick="handleOpenFile"
        @contextmenu.prevent="showContextMenu"
        @dragstart="handleDragStart"
        @dragend="handleDragEnd"
      >
        <v-icon size="16" class="file-icon" color="primary">mdi-file-document-outline</v-icon>
        
        <!-- Rename input -->
        <input
          v-if="isRenaming"
          ref="renameInput"
          v-model="newName"
          class="rename-input"
          @keydown.enter="confirmRename"
          @keydown.escape="cancelRename"
          @blur="confirmRename"
          @click.stop
        />
        <span v-else class="item-name" :title="displayName">{{ displayName }}</span>
        
        <!-- Hover actions -->
        <div class="item-actions" @click.stop>
          <v-btn
            icon
            variant="text"
            size="x-small"
            title="Rename"
            @click="startRename"
          >
            <v-icon size="12">mdi-pencil-outline</v-icon>
          </v-btn>
          <v-btn
            icon
            variant="text"
            size="x-small"
            title="Delete"
            @click="handleDelete"
          >
            <v-icon size="12">mdi-delete-outline</v-icon>
          </v-btn>
          <v-btn
            icon
            variant="text"
            size="x-small"
            title="More Actions"
            @click.stop="showContextMenu"
          >
            <v-icon size="12">mdi-dots-horizontal</v-icon>
          </v-btn>
        </div>
      </div>
    </template>

    <!-- Context Menu -->
    <v-menu
      v-model="contextMenuOpen"
      :style="{ position: 'fixed', left: contextMenuX + 'px', top: contextMenuY + 'px' }"
      location="bottom start"
      :close-on-content-click="true"
    >
      <v-list density="compact" class="context-menu-list">
        <!-- Directory specific options -->
        <template v-if="entry.kind === 'directory'">
          <v-list-item @click="handleNewFile" prepend-icon="mdi-file-plus-outline">
            <v-list-item-title>New File</v-list-item-title>
          </v-list-item>
          <v-list-item @click="handleNewFolder" prepend-icon="mdi-folder-plus-outline">
            <v-list-item-title>New Folder</v-list-item-title>
          </v-list-item>
          <v-divider />
        </template>
        
        <v-list-item @click="startRename" prepend-icon="mdi-pencil-outline">
          <v-list-item-title>Rename</v-list-item-title>
        </v-list-item>

        <v-list-item 
          v-if="entry.kind === 'file'"
          @click="handleSmartRename" 
          prepend-icon="mdi-magic-staff"
          :disabled="isGeneratingName"
        >
          <v-list-item-title>
            {{ isGeneratingName ? 'Generating Name...' : 'Smart Rename (AI)' }}
          </v-list-item-title>
        </v-list-item>
        
        <v-list-item @click="handleDelete" prepend-icon="mdi-delete-outline" class="delete-item">
          <v-list-item-title>Delete</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useGeminiAI } from '../composables/useGeminiAI';
import { useFileSystemStore } from '../stores/fileSystemStore';
import type { LocalDirectory, LocalFile } from '../types/fileSystem';

const props = defineProps<{
  entry: LocalFile | LocalDirectory
  vaultId: string
  depth: number
}>()

const emit = defineEmits<{
  (e: 'open-file', file: LocalFile, vaultId: string): void
  (e: 'toggle-directory', vaultId: string, path: string): void
  (e: 'create-file', vaultId: string, parentPath: string): void
  (e: 'create-folder', vaultId: string, parentPath: string): void
  (e: 'rename', vaultId: string, path: string, kind: 'file' | 'directory', newName: string): void
  (e: 'delete', vaultId: string, path: string, kind: 'file' | 'directory'): void
  (e: 'move', vaultId: string, sourcePath: string, targetPath: string, kind: 'file' | 'directory'): void
}>()

// State
const contextMenuOpen = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const isRenaming = ref(false)
const newName = ref('')
const renameInput = ref<HTMLInputElement | null>(null)
const isDropTarget = ref(false)
const isDragging = ref(false)
const isGeneratingName = ref(false)

const fileSystemStore = useFileSystemStore()
const { generateFilename } = useGeminiAI()

const displayName = computed(() => {
  if (props.entry.kind !== 'file') return props.entry.name
  // Remove .md extension for display
  return props.entry.name.replace(/\.md$/, '').replace(/\.markdown$/, '')
})

function getFileCount(dir: LocalDirectory): string {
  let count = 0
  
  function countFiles(items: (LocalFile | LocalDirectory)[]): void {
    for (const item of items) {
      if (item.kind === 'file') {
        count++
      } else if (item.kind === 'directory') {
        countFiles(item.children)
      }
    }
  }
  
  countFiles(dir.children)
  return count > 0 ? `${count}` : ''
}

function handleOpenFile() {
  if (props.entry.kind === 'file') {
    emit('open-file', props.entry as LocalFile, props.vaultId)
  }
}

function handleToggleDirectory() {
  if (props.entry.kind === 'directory') {
    emit('toggle-directory', props.vaultId, props.entry.path)
  }
}

function showContextMenu(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuOpen.value = true
}

function handleNewFile() {
  contextMenuOpen.value = false
  if (props.entry.kind === 'directory') {
    emit('create-file', props.vaultId, props.entry.path)
  }
}

function handleNewFolder() {
  contextMenuOpen.value = false
  if (props.entry.kind === 'directory') {
    emit('create-folder', props.vaultId, props.entry.path)
  }
}

async function handleSmartRename() {
  contextMenuOpen.value = false
  if (props.entry.kind !== 'file') return

  try {
    isGeneratingName.value = true
    // Need to cast because entry.handle in LocalFile is FileSystemFileHandle
    // but props.entry is LocalFile | LocalDirectory
    const content = await fileSystemStore.readFile((props.entry as LocalFile).handle)
    const suggestedName = await generateFilename(content)
    
    if (suggestedName) {
      newName.value = suggestedName
      isRenaming.value = true
      nextTick(() => {
        if (renameInput.value) {
          renameInput.value.focus()
          renameInput.value.select()
        }
      })
    }
  } catch (error) {
    console.error('Smart rename failed:', error)
    // Fallback to normal rename if AI fails
    startRename()
  } finally {
    isGeneratingName.value = false
  }
}

function startRename() {
  contextMenuOpen.value = false
  // For files, remove the .md extension in edit mode
  if (props.entry.kind === 'file') {
    newName.value = props.entry.name.replace(/\.md$/, '').replace(/\.markdown$/, '')
  } else {
    newName.value = props.entry.name
  }
  isRenaming.value = true
  nextTick(() => {
    if (renameInput.value) {
      renameInput.value.focus()
      renameInput.value.select()
    }
  })
}

function confirmRename() {
  if (!isRenaming.value) return
  
  const trimmedName = newName.value.trim()
  if (trimmedName && trimmedName !== props.entry.name && trimmedName !== displayName.value) {
    emit('rename', props.vaultId, props.entry.path, props.entry.kind, trimmedName)
  }
  isRenaming.value = false
}

function cancelRename() {
  isRenaming.value = false
  newName.value = ''
}

function handleDelete() {
  contextMenuOpen.value = false
  emit('delete', props.vaultId, props.entry.path, props.entry.kind)
}

// Drag and Drop
function handleDragStart(event: DragEvent) {
  isDragging.value = true
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/json', JSON.stringify({
      vaultId: props.vaultId,
      path: props.entry.path,
      kind: props.entry.kind
    }))
  }
}

function handleDragEnd() {
  isDragging.value = false
}

function handleDragOver(event: DragEvent) {
  // Only directories can be drop targets
  if (props.entry.kind === 'directory') {
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
    isDropTarget.value = true
  }
}

function handleDragLeave(event: DragEvent) {
  event.stopPropagation()
  isDropTarget.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  isDropTarget.value = false
  
  if (props.entry.kind !== 'directory') return
  
  if (event.dataTransfer) {
    try {
      const data = JSON.parse(event.dataTransfer.getData('application/json'))
      
      // Don't drop on self or parent
      if (data.path === props.entry.path) return
      if (props.entry.path.startsWith(data.path + '/')) return
      
      emit('move', props.vaultId, data.path, props.entry.path, data.kind)
    } catch {
      console.error('Failed to parse drag data')
    }
  }
}
</script>

<style scoped>
.local-file-item {
  user-select: none;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  cursor: pointer;
  border-radius: 4px;
  margin: 1px 4px;
  transition: all 0.15s ease;
  position: relative;
}

.item-row:hover {
  background: rgba(var(--v-theme-primary), 0.08);
}

.item-row:hover .item-actions {
  opacity: 1;
}

.directory-row {
  font-weight: 500;
}

.directory-row.expanded .folder-icon {
  color: rgb(var(--v-theme-primary));
}

.directory-row.drop-target {
  background: rgba(var(--v-theme-primary), 0.2);
  outline: 2px dashed rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.expand-icon {
  flex-shrink: 0;
  opacity: 0.6;
  transition: transform 0.2s ease;
}

.folder-icon {
  flex-shrink: 0;
  color: rgba(var(--v-theme-on-surface), 0.7);
  transition: color 0.2s ease;
}

.file-icon {
  flex-shrink: 0;
}

.item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.item-count {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.4);
  padding: 2px 6px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.item-actions {
  display: flex;
  opacity: 0;
  transition: opacity 0.15s;
  /* Float on the right */
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  padding-right: 8px; /* space from right edge */
  padding-left: 24px; /* affordance for gradient */
  align-items: center;
  z-index: 10;
  gap: 2px;
  
  /* Gradient background to fade out text */
  background: linear-gradient(
    to right, 
    transparent 0%, 
    var(--bg-sidebar) 30%
  );
}

.file-row:active {
  background: rgba(var(--v-theme-primary), 0.15);
}

/* Dragging state */
.item-row.dragging {
  opacity: 0.5;
  background: rgba(var(--v-theme-primary), 0.1);
}

.directory-children {
  /* Reserved for future animation */
  overflow: hidden;
}

/* Visual indicator for currently open file - to be implemented */
.file-row.active {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}

.file-row.active .item-name {
  font-weight: 500;
}

/* Rename input */
.rename-input {
  flex: 1;
  border: 1px solid rgb(var(--v-theme-primary));
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
  background: var(--bg-surface);
  color: var(--text-primary);
  outline: none;
  min-width: 0;
}

.rename-input:focus {
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.2);
}

/* Context menu */
.context-menu-list {
  min-width: 140px;
}

.context-menu-list .v-list-item {
  min-height: 28px;
  padding-top: 2px !important;
  padding-bottom: 2px !important;
  padding-left: 8px !important;
  padding-right: 8px !important;
}

.context-menu-list :deep(.v-list-item-title) {
  font-size: 11px !important;
  line-height: 1.2;
}

.context-menu-list :deep(.v-list-item__prepend) {
  width: 18px;
  min-width: 18px;
  margin-right: 6px;
}

.context-menu-list :deep(.v-icon) {
  font-size: 14px;
  opacity: 0.8;
}

.context-menu-list .delete-item {
  color: rgb(var(--v-theme-error));
}
</style>
