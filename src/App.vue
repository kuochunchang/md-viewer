<template>
  <v-app>
    <v-app-bar class="app-bar" :class="{ 'is-dark': isDark }" flat>
      <v-btn
        icon
        variant="text"
        size="small"
        class="layout-toggle-btn mr-2"
        :title="showEditor ? 'Hide Editor (Full Preview)' : 'Show Editor (Split View)'"
        @click="tabsStore.toggleEditor"
      >
        <v-icon>{{ showEditor ? 'mdi-backburger' : 'mdi-forwardburger' }}</v-icon>
      </v-btn>
      <TabBar />
      <SettingsMenu />
    </v-app-bar>
    <v-main>
      <div class="app-container">
        <SplitPane
          :initial-ratio="0.35"
          :min-ratio="0.1"
          :max-ratio="0.9"
          :collapsed="!showEditor"
        >
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
import { useTheme } from 'vuetify'
import MarkdownEditor from './components/MarkdownEditor.vue'
import MarkdownPreview from './components/MarkdownPreview.vue'
import SettingsMenu from './components/SettingsMenu.vue'
import SplitPane from './components/SplitPane.vue'
import TabBar from './components/TabBar.vue'
import { useTabsStore } from './stores/tabsStore'

const tabsStore = useTabsStore()
const theme = useTheme()

const isDark = computed(() => theme.global.name.value === 'dark')
const activeTabContent = computed(() => tabsStore.activeTabContent)
const fontSize = computed(() => tabsStore.fontSize)
const showEditor = computed(() => tabsStore.showEditor)

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
  height: 100%;
  overflow: hidden;
}

:deep(.v-main) {
  height: 100vh;
}


// Global styles: Optimize app-bar display on mobile
:deep(.app-bar) {
  background-color: #ECECEC !important;
  border-bottom: 1px solid #E1E1E1 !important;

  &.is-dark {
    background-color: #252526 !important;
    border-bottom: 1px solid #2D2D2D !important;
  }

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

  .layout-toggle-btn {
    margin-left: 8px;
    color: rgba(var(--v-theme-on-surface), 0.7);

    &:hover {
      color: var(--v-theme-primary);
    }
  }
}
</style>
