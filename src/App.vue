<template>
  <v-app class="app-wrapper">
    <v-navigation-drawer
      v-model="showSidebar"
      width="280"
      class="sidebar-drawer"
      floating
    >
      <FileList />
    </v-navigation-drawer>

    <v-app-bar class="app-header" flat height="48">
      <div class="d-flex align-center h-100 w-100 pl-2" style="overflow: hidden;">
        <!-- Menu Button (Fixed Left) -->
        <v-btn
          icon
          variant="text"
          size="small"
          class="nav-btn mr-2 flex-shrink-0"
          :title="showSidebar ? 'Hide Sidebar' : 'Show Sidebar'"
          @click="tabsStore.toggleSidebar"
        >
          <v-icon size="20">mdi-menu</v-icon>
        </v-btn>

        <!-- Tab Bar (Fluid Middle) -->
        <TabBar style="min-width: 0;" />
        
        <!-- Editor Toggle / Right Actions (Fixed Right) -->
        <div class="d-flex align-center pr-2 gap-2 flex-shrink-0">
           <v-btn
            icon
            variant="text"
            size="small"
            class="nav-btn"
            :title="showEditor ? 'Preview Mode' : 'Split Mode'"
            @click="tabsStore.toggleEditor"
          >
            <v-icon size="20">{{ showEditor ? 'mdi-book-open-outline' : 'mdi-book-open-variant' }}</v-icon>
          </v-btn>
          
          <v-divider vertical class="mx-2 my-auto" style="height: 20px" inset></v-divider>
          
          <SettingsMenu />
        </div>
      </div>
    </v-app-bar>

    <v-main>
      <div class="app-container">
        <SplitPane
          :initial-ratio="0.4"
          :min-ratio="0.1"
          :max-ratio="0.9"
          :collapsed="!showEditor"
        >
          <template #left>
            <MarkdownEditor
              ref="editorRef"
              :model-value="activeTabContent"
              :font-size="fontSize"
              @update:model-value="handleContentUpdate"
              @scroll="handleEditorScroll"
            />
          </template>
          <template #right>
            <MarkdownPreview
              ref="previewRef"
              :content="activeTabContent"
              :font-size="fontSize"
              @scroll="handlePreviewScroll"
            />
          </template>
        </SplitPane>
      </div>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import FileList from './components/FileList.vue'
import MarkdownEditor from './components/MarkdownEditor.vue'
import MarkdownPreview from './components/MarkdownPreview.vue'
import SettingsMenu from './components/SettingsMenu.vue'
import SplitPane from './components/SplitPane.vue'
import TabBar from './components/TabBar.vue'
import { useTabsStore } from './stores/tabsStore'

const tabsStore = useTabsStore()

const activeTabContent = computed(() => tabsStore.activeTabContent)
const fontSize = computed(() => tabsStore.fontSize)
const showEditor = computed(() => tabsStore.showEditor)
const showSidebar = computed({
  get: () => tabsStore.showSidebar,
  set: (val) => {
    if (val !== tabsStore.showSidebar) {
      tabsStore.toggleSidebar()
    }
  }
})

// Scroll Sync Logic
const editorRef = ref<any>(null)
const previewRef = ref<any>(null)
const isSyncingLeft = ref(false)
const isSyncingRight = ref(false)

function handleEditorScroll(ratio: number) {
  if (isSyncingLeft.value) return
  isSyncingRight.value = true
  previewRef.value?.scrollToRatio(ratio)
  setTimeout(() => { isSyncingRight.value = false }, 50)
}

function handlePreviewScroll(ratio: number) {
  if (isSyncingRight.value) return
  isSyncingLeft.value = true
  editorRef.value?.scrollToRatio(ratio)
  setTimeout(() => { isSyncingLeft.value = false }, 50)
}

function handleContentUpdate(content: string) {
  if (tabsStore.activeTabId) {
    tabsStore.updateTabContent(tabsStore.activeTabId, content)
  }
}

// Initialization
onMounted(() => {
  tabsStore.initialize()
})
</script>

<style scoped lang="scss">
// CSS Variables are defined in main.scss -> variables.scss globally
// No need to import variables.scss here unless using SCSS vars

.app-wrapper {
  background: var(--bg-app);
  height: 100vh;     // Force full viewport height
  overflow: hidden;  // Prevent global window scroll
}

.app-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden; // Ensure internal components handle scrolling
}

// Ensure v-main takes available space but doesn't overflow window
:deep(.v-main) {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

// Sidebar Customization
:deep(.sidebar-drawer) {
  background-color: var(--bg-sidebar) !important;
  border-right: 1px solid var(--border-color);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  .v-navigation-drawer__content {
    &::-webkit-scrollbar {
      width: 4px;
    }
  }
}

// Header Customization
:deep(.app-header) {
  background-color: var(--bg-header) !important;
  border-bottom: 1px solid var(--border-color) !important;
  backdrop-filter: blur(10px);
  z-index: 10;
  
  .v-toolbar__content {
    padding: 0;
    overflow: visible;
  }
}

.nav-btn {
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  
  &:hover {
    color: var(--text-primary);
    background-color: var(--bg-surface-hover);
  }
}
</style>
