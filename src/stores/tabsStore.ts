import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  loadFromLocalStorage,
  saveToLocalStorage,
  type StoredTabsData
} from '../composables/useLocalStorage'
import type { Tab } from '../types'
import { debounce } from '../utils/debounce'
import { DEFAULT_CONTENT } from '../utils/defaultContent'

export const useTabsStore = defineStore('tabs', () => {
  // State
  const tabs = ref<Tab[]>([])
  const openTabIds = ref<string[]>([])
  const activeTabId = ref<string | null>(null)
  const fontSize = ref<number>(14)
  const showEditor = ref<boolean>(true)
  const showSidebar = ref<boolean>(true)

  // Getters
  const activeTab = computed(() => {
    return tabs.value.find(tab => tab.id === activeTabId.value) || null
  })

  const activeTabContent = computed(() => {
    return activeTab.value?.content || ''
  })

  const openTabs = computed(() => {
    return openTabIds.value
      .map(id => tabs.value.find(tab => tab.id === id))
      .filter((tab): tab is Tab => !!tab)
  })

  // Actions
  function addTab(name?: string): string {
    const isFirstTab = tabs.value.length === 0
    const newTab: Tab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: name || `New Document ${tabs.value.length + 1}`,
      content: isFirstTab ? DEFAULT_CONTENT : '', // Only the first tab uses the template, others are blank
      createdAt: Date.now()
    }
    tabs.value.push(newTab)
    openTabIds.value.push(newTab.id)
    activeTabId.value = newTab.id
    saveToStore()
    return newTab.id
  }

  function openTab(id: string): void {
    if (!openTabIds.value.includes(id)) {
      openTabIds.value.push(id)
    }
    activeTabId.value = id
    saveToStore()
  }

  function closeTab(id: string): void {
    const index = openTabIds.value.indexOf(id)
    if (index === -1) return

    openTabIds.value.splice(index, 1)

    // If closing the active tab, switch to another open tab
    if (activeTabId.value === id) {
      if (openTabIds.value.length > 0) {
        const nextIndex = index < openTabIds.value.length ? index : index - 1
        activeTabId.value = openTabIds.value[nextIndex] || openTabIds.value[0] || null
      } else {
        activeTabId.value = null
      }
    }
    saveToStore()
  }

  function deleteFile(id: string): void {
    const index = tabs.value.findIndex(tab => tab.id === id)
    if (index === -1) return

    // Remove from open tabs first
    if (openTabIds.value.includes(id)) {
      closeTab(id)
    }

    // Then remove from master list
    tabs.value.splice(index, 1)

    // If no tabs left at all, create a default one
    if (tabs.value.length === 0) {
      addTab('Welcome')
    }

    saveToStore()
  }

  function setActiveTab(id: string): void {
    if (tabs.value.some(tab => tab.id === id)) {
      // If the tab isn't open yet, open it
      if (!openTabIds.value.includes(id)) {
        openTabIds.value.push(id)
      }
      activeTabId.value = id
      saveToStore()
    }
  }

  function updateTabContent(id: string, content: string): void {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.content = content
    }
  }

  function renameTab(id: string, name: string): void {
    const tab = tabs.value.find(t => t.id === id)
    if (tab && name.trim()) {
      tab.name = name.trim()
      saveToStore()
    }
  }

  function setFontSize(size: number): void {
    fontSize.value = Math.max(10, Math.min(24, size))
    saveToStore()
  }

  function toggleEditor(): void {
    showEditor.value = !showEditor.value
    saveToStore()
  }

  function toggleSidebar(): void {
    showSidebar.value = !showSidebar.value
    saveToStore()
  }

  function saveToStore(): void {
    const data: StoredTabsData = {
      tabs: tabs.value,
      activeTabId: activeTabId.value,
      openTabIds: openTabIds.value,
      fontSize: fontSize.value,
      showSidebar: showSidebar.value,
      showEditor: showEditor.value
    }
    saveToLocalStorage(data)
  }

  function loadFromStore(): boolean {
    const stored = loadFromLocalStorage()
    if (stored && stored.tabs.length > 0) {
      tabs.value = stored.tabs

      // Restore open tabs
      if (stored.openTabIds && Array.isArray(stored.openTabIds)) {
        openTabIds.value = stored.openTabIds.filter(id => tabs.value.some(t => t.id === id))
      } else {
        // Fallback: if no openTabIds stored, open all tabs
        openTabIds.value = tabs.value.map(t => t.id)
      }

      // Restore active tab
      if (stored.activeTabId && tabs.value.some(t => t.id === stored.activeTabId)) {
        activeTabId.value = stored.activeTabId
      } else {
        activeTabId.value = openTabIds.value[0] || tabs.value[0]?.id || null
      }

      if (stored.fontSize) {
        fontSize.value = Math.max(10, Math.min(24, stored.fontSize))
      }

      if (stored.showEditor !== undefined) {
        showEditor.value = stored.showEditor
      }

      if (stored.showSidebar !== undefined) {
        showSidebar.value = stored.showSidebar
      }

      return true
    }
    return false
  }

  const debouncedSave = debounce(saveToStore, 500)

  watch(
    [tabs, activeTabId, openTabIds, fontSize, showEditor, showSidebar],
    () => {
      if (tabs.value.length > 0) {
        debouncedSave()
      }
    },
    { deep: true }
  )

  function initialize(): void {
    const loaded = loadFromStore()
    if (!loaded && tabs.value.length === 0) {
      addTab('Welcome')
    }
  }

  return {
    tabs,
    openTabIds,
    activeTabId,
    fontSize,
    showEditor,
    showSidebar,
    activeTab,
    activeTabContent,
    openTabs,
    addTab,
    openTab,
    closeTab,
    deleteFile,
    setActiveTab,
    updateTabContent,
    renameTab,
    setFontSize,
    toggleEditor,
    toggleSidebar,
    initialize,
    saveToStore,
    loadFromStore
  }
})
