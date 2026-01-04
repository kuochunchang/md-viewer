<template>
  <div class="status-bar">
    <!-- Left Section: File Info -->
    <div class="status-section left">
      <!-- Document Info -->
      <div class="status-item" v-if="activeTab">
        <v-icon size="12" class="mr-1">mdi-file-document-outline</v-icon>
        <span class="status-text">{{ activeTab.name }}</span>
      </div>
      
      <!-- Word/Char Count -->
      <div class="status-item" v-if="activeTab">
        <v-icon size="12" class="mr-1">mdi-format-letter-case</v-icon>
        <span class="status-text">{{ charCount }} chars</span>
        <span class="status-separator">|</span>
        <span class="status-text">{{ wordCount }} words</span>
        <span class="status-separator">|</span>
        <span class="status-text">{{ lineCount }} lines</span>
      </div>
    </div>

    <!-- Center Section: Storage Info -->
    <div class="status-section center">
      <!-- Storage Status Indicator -->
      <div 
        class="status-item storage-status"
        @click="openSettings"
        title="Click to open settings"
      >
        <v-icon size="12" class="mr-1">mdi-harddisk</v-icon>
        <span class="status-text">Local Storage</span>
      </div>
    </div>

    <!-- Right Section: File Count -->
    <div class="status-section right">
      <!-- Total Files Count -->
      <div class="status-item">
        <v-icon size="12" class="mr-1">mdi-folder-multiple-outline</v-icon>
        <span class="status-text">{{ tabCount }} files</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '../stores/settingsStore'
import { useTabsStore } from '../stores/tabsStore'

const tabsStore = useTabsStore()
const settingsStore = useSettingsStore()

// Active Tab
const activeTab = computed(() => tabsStore.activeTab)

// Document Stats
const charCount = computed(() => {
  const content = activeTab.value?.content || ''
  return content.length
})

const wordCount = computed(() => {
  const content = activeTab.value?.content || ''
  if (!content.trim()) return 0
  // Count words (supports CJK characters as individual words)
  const cjkChars = content.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff]/g)?.length || 0
  const words = content.trim().split(/\s+/).filter(w => w.length > 0 && !/^[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff]+$/.test(w)).length
  return words + cjkChars
})

const lineCount = computed(() => {
  const content = activeTab.value?.content || ''
  if (!content) return 0
  return content.split('\n').length
})

// Tab Count
const tabCount = computed(() => tabsStore.tabs.length)

// Open Settings
function openSettings() {
  settingsStore.openSettingsDialog()
}
</script>

<style scoped lang="scss">
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;
  padding: 0 12px;
  background: var(--bg-surface);
  border-top: 1px solid var(--border-color);
  font-size: 11px;
  color: var(--text-secondary);
  user-select: none;
  flex-shrink: 0;
}

.status-section {
  display: flex;
  align-items: center;
  gap: 12px;
  
  &.left {
    flex: 1;
    justify-content: flex-start;
  }
  
  &.center {
    flex: 1;
    justify-content: center;
  }
  
  &.right {
    flex: 1;
    justify-content: flex-end;
  }
}

.status-item {
  display: flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
  
  .v-icon {
    opacity: 0.7;
  }
  
  &.storage-status {
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all 0.2s ease;
    color: var(--text-secondary);
    
    &:hover {
      background: var(--bg-surface-hover);
    }
  }
}

.status-text {
  line-height: 1;
}

.status-separator {
  margin: 0 4px;
  opacity: 0.4;
}

// Responsive: hide some items on smaller screens
@media (max-width: 768px) {
  .status-section.center {
    display: none;
  }
  
  .status-section.left,
  .status-section.right {
    flex: 1;
  }
}

@media (max-width: 480px) {
  .status-bar {
    padding: 0 8px;
    font-size: 10px;
    gap: 8px;
  }
  
  .status-section {
    gap: 8px;
  }
  
  .status-separator {
    display: none;
  }
}
</style>
