<template>
  <v-app>
    <v-app-bar class="app-bar">
      <TabBar />
      <SettingsMenu />
    </v-app-bar>
    <v-main>
      <div class="app-container">
        <SplitPane :initial-ratio="0.35" :min-ratio="0.2" :max-ratio="0.8">
          <template #left>
            <MarkdownEditor
              :model-value="activeTabContent"
              :font-size="fontSize"
              @update:model-value="handleContentUpdate"
            />
          </template>
          <template #right>
            <MarkdownPreview
              :content="activeTabContent"
              :font-size="fontSize"
            />
          </template>
        </SplitPane>
      </div>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import MarkdownEditor from './components/MarkdownEditor.vue'
import MarkdownPreview from './components/MarkdownPreview.vue'
import SettingsMenu from './components/SettingsMenu.vue'
import SplitPane from './components/SplitPane.vue'
import TabBar from './components/TabBar.vue'
import { useTabsStore } from './stores/tabsStore'

const tabsStore = useTabsStore()

const activeTabContent = computed(() => tabsStore.activeTabContent)
const fontSize = computed(() => tabsStore.fontSize)

function handleContentUpdate(content: string) {
  if (tabsStore.activeTabId) {
    tabsStore.updateTabContent(tabsStore.activeTabId, content)
  }
}

// Initialization: ensure at least one tab exists
onMounted(() => {
  tabsStore.initialize()
})
</script>

<style scoped lang="scss">
.app-container {
  width: 100%;
  height: 100vh;
  overflow: hidden;

  // RWD: Mobile layout adjustment
  @media (max-width: 600px) {
    height: calc(100vh - 56px); // Subtract app-bar height
  }
}

// Global styles: Optimize app-bar display on mobile
:deep(.app-bar) {
  .v-toolbar__content {
    padding: 0;
    overflow: hidden;
  }

  // RWD: Mobile layout adjustment
  @media (max-width: 600px) {
    .v-toolbar__content {
      padding: 0 4px;
    }
  }
}
</style>
