<template>
  <div class="tab-bar" :class="{ 'is-dark': isDark }">
    <div class="tabs-container">
      <TabItem
        v-for="tab in openTabs"
        :key="tab.id"
        :tab="tab"
        :is-active="tab.id === activeTabId"
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
      >
        <v-icon>mdi-plus</v-icon>
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from 'vuetify'
import { useTabsStore } from '../stores/tabsStore'
import TabItem from './TabItem.vue'

const tabsStore = useTabsStore()
const theme = useTheme()

const isDark = computed(() => theme.global.name.value === 'dark')

const openTabs = computed(() => tabsStore.openTabs)
const activeTabId = computed(() => tabsStore.activeTabId)

function handleAddTab() {
  tabsStore.addTab()
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
</script>

<style scoped lang="scss">
.tab-bar {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 8px 0;
  background-color: transparent;
  border-bottom: none;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;
  min-width: 0;
  height: 100%;

  // RWD
  @media (max-width: 600px) {
    gap: 4px;
    padding: 4px 8px 0;
  }

  // Dark theme compatibility
  &.is-dark {
    .add-tab-btn {
      color: #969696;
      &:hover {
        background-color: rgba(255, 255, 255, 0.08);
        color: #E0E0E0;
      }
    }
  }
}

.tabs-container {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  height: 100%;
  padding-bottom: 0;

  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.add-tab-btn {
  flex-shrink: 0;
  margin-bottom: 4px;
  color: #616161;

  &:hover {
    background-color: rgba(0, 0, 0, 0.08);
    color: #333333;
  }
}
</style>
