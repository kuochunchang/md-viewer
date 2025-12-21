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
import { useTabsStore } from './stores/tabsStore'
import SplitPane from './components/SplitPane.vue'
import MarkdownEditor from './components/MarkdownEditor.vue'
import MarkdownPreview from './components/MarkdownPreview.vue'
import TabBar from './components/TabBar.vue'
import SettingsMenu from './components/SettingsMenu.vue'

const tabsStore = useTabsStore()

const activeTabContent = computed(() => tabsStore.activeTabContent)
const fontSize = computed(() => tabsStore.fontSize)

function handleContentUpdate(content: string) {
  if (tabsStore.activeTabId) {
    tabsStore.updateTabContent(tabsStore.activeTabId, content)
  }
}

// 初始化：確保至少有一個頁籤
onMounted(() => {
  tabsStore.initialize()
})
</script>

<style scoped lang="scss">
.app-container {
  width: 100%;
  height: 100vh;
  overflow: hidden;

  // RWD: 手機版面調整
  @media (max-width: 600px) {
    height: calc(100vh - 56px); // 扣除 app-bar 高度
  }
}

// 全域樣式：優化 app-bar 在手機上的顯示
:deep(.app-bar) {
  .v-toolbar__content {
    padding: 0;
    overflow: hidden;
  }

  // RWD: 手機版面調整
  @media (max-width: 600px) {
    .v-toolbar__content {
      padding: 0 4px;
    }
  }
}
</style>
