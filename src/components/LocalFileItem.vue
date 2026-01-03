<template>
  <div class="local-file-item">
    <!-- Directory -->
    <template v-if="entry.kind === 'directory'">
      <div 
        class="item-row directory-row"
        :class="{ expanded: entry.expanded }"
        :style="{ paddingLeft: `${depth * 12 + 8}px` }"
        @click="handleToggleDirectory"
      >
        <v-icon size="14" class="expand-icon">
          {{ entry.expanded ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
        </v-icon>
        <v-icon size="16" class="folder-icon">
          {{ entry.expanded ? 'mdi-folder-open' : 'mdi-folder' }}
        </v-icon>
        <span class="item-name" :title="entry.name">{{ entry.name }}</span>
        <span class="item-count">{{ getFileCount(entry) }}</span>
      </div>

      <!-- Children -->
      <div v-show="entry.expanded" class="directory-children">
        <LocalFileItem
          v-for="child in entry.children"
          :key="child.path"
          :entry="child"
          :depth="depth + 1"
          @open-file="$emit('open-file', $event)"
          @toggle-directory="$emit('toggle-directory', $event)"
        />
      </div>
    </template>

    <!-- File -->
    <template v-else>
      <div 
        class="item-row file-row"
        :style="{ paddingLeft: `${depth * 12 + 22}px` }"
        @click="handleOpenFile"
        @dblclick="handleOpenFile"
      >
        <v-icon size="16" class="file-icon" color="primary">mdi-file-document-outline</v-icon>
        <span class="item-name" :title="displayName">{{ displayName }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { LocalDirectory, LocalFile } from '../types/fileSystem';

const props = defineProps<{
  entry: LocalFile | LocalDirectory
  depth: number
}>()

const emit = defineEmits<{
  (e: 'open-file', file: LocalFile): void
  (e: 'toggle-directory', path: string): void
}>()

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
    emit('open-file', props.entry as LocalFile)
  }
}

function handleToggleDirectory() {
  if (props.entry.kind === 'directory') {
    emit('toggle-directory', props.entry.path)
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
}

.item-row:hover {
  background: rgba(var(--v-theme-primary), 0.08);
}

.directory-row {
  font-weight: 500;
}

.directory-row.expanded .folder-icon {
  color: rgb(var(--v-theme-primary));
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
  font-size: 13px;
}

.item-count {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.4);
  padding: 2px 6px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.file-row:active {
  background: rgba(var(--v-theme-primary), 0.15);
}

.directory-children {
  /* Smooth expand/collapse could be added with height animation */
}

/* Visual indicator for currently open file - to be implemented */
.file-row.active {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}

.file-row.active .item-name {
  font-weight: 500;
}
</style>
