<template>
  <div class="tab-bar">
    <div class="tabs-container">
      <TabItem
        v-for="(tab, index) in openTabs"
        :key="tab.id"
        :tab="tab"
        :is-active="tab.id === activeTabId"
        :tab-index="index"
        draggable="true"
        @dragstart="handleDragStart($event, index)"
        @dragover.prevent
        @drop="handleDrop($event, index)"
        @dragend="handleDragEnd"
        @select="handleSelect"
        @close="handleClose"
        @rename="handleRename"
      />
      <v-btn
        icon
        variant="text"
        size="small"
        class="add-tab-btn"
        @click="handleAddTab"
        title="New Tab"
      >
        <v-icon size="18">mdi-plus</v-icon>
      </v-btn>
      <v-btn
        icon
        variant="text"
        size="small"
        class="action-btn"
        @click="handleCopyAll"
        title="Copy All Tabs"
      >
        <v-icon size="18">mdi-content-copy</v-icon>
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTabsStore } from '../stores/tabsStore'
import TabItem from './TabItem.vue'

const tabsStore = useTabsStore()

const openTabs = computed(() => tabsStore.openTabs)
const activeTabId = computed(() => tabsStore.activeTabId)

function handleAddTab() {
  tabsStore.addTab()
}

async function handleCopyAll() {
  const content = openTabs.value
    .map(tab => `# ${tab.name}\n\n${tab.content}`)
    .join('\n\n---\n\n')
  
  try {
    await navigator.clipboard.writeText(content)
    // Could add visual feedback here if we had a toast system
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

function handleSelect(id: string) {
  tabsStore.setActiveTab(id)
}

function handleClose(id: string) {
  tabsStore.closeTab(id)
}

function handleRename(id: string, name: string) {
  tabsStore.renameTab(id, name)
}

function handleDragStart(event: DragEvent, index: number) {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', index.toString())
    if (event.target instanceof HTMLElement) {
      event.target.style.opacity = '0.5'
    }
  }
}

function handleDragEnd(event: DragEvent) {
  if (event.target instanceof HTMLElement) {
    event.target.style.opacity = ''
  }
}

function handleDrop(event: DragEvent, toIndex: number) {
  if (event.dataTransfer) {
    const fromIndex = parseInt(event.dataTransfer.getData('text/plain'))
    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      tabsStore.reorderTabs(fromIndex, toIndex)
    }
  }
}
</script>

<style scoped lang="scss">
@import '../styles/variables.scss';

.tab-bar {
  display: flex;
  align-items: flex-end;
  height: 100%;
  flex: 1;
  min-width: 0;
  padding-top: 8px; // Align tabs with bottom of header
  overflow: hidden;
}

.tabs-container {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  height: 100%;
  padding: 0 12px 0 4px;
  
  // Hide scrollbar but allow scrolling
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.add-tab-btn,
.action-btn {
  flex-shrink: 0;
  margin-bottom: 6px; // Align vertically with tabs
  margin-left: 4px;
  color: var(--text-tertiary);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);

  &:hover {
    background-color: var(--bg-surface-hover);
    color: var(--text-primary);
  }
}
</style>
