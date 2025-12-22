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
  const activeTabId = ref<string | null>(null)
  const fontSize = ref<number>(14)
  const showEditor = ref<boolean>(true)

  // Getters
  const activeTab = computed(() => {
    return tabs.value.find(tab => tab.id === activeTabId.value) || null
  })

  const activeTabContent = computed(() => {
    return activeTab.value?.content || ''
  })

  // Actions
  function addTab(name?: string): string {
    const isFirstTab = tabs.value.length === 0
    const newTab: Tab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name || `New Document ${tabs.value.length + 1}`,
      content: isFirstTab ? DEFAULT_CONTENT : '', // Only the first tab uses the template, others are blank
      createdAt: Date.now()
    }
    tabs.value.push(newTab)
    activeTabId.value = newTab.id
    // Save immediately after adding a tab (avoid debounce)
    saveToStore()
    return newTab.id
  }

  function removeTab(id: string): void {
    const index = tabs.value.findIndex(tab => tab.id === id)
    if (index === -1) return

    tabs.value.splice(index, 1)

    // If deleting the active tab, switch to another tab
    if (activeTabId.value === id) {
      if (tabs.value.length > 0) {
        // Prefer next tab, otherwise previous tab
        const nextIndex = index < tabs.value.length ? index : index - 1
        activeTabId.value = tabs.value[nextIndex]?.id || tabs.value[0]?.id || null
      } else {
        activeTabId.value = null
        // If no tabs left, automatically create one
        addTab()
        return // addTab already triggers save
      }
    }
    // Save immediately after removing a tab (avoid debounce)
    saveToStore()
  }

  function setActiveTab(id: string): void {
    if (tabs.value.some(tab => tab.id === id)) {
      activeTabId.value = id
      // Save immediately after switching tab (avoid debounce)
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
      // Save immediately after renaming (avoid debounce)
      saveToStore()
    }
  }

  function setFontSize(size: number): void {
    fontSize.value = Math.max(10, Math.min(24, size)) // Limit to 10-24
    saveToStore()
  }

  function toggleEditor(): void {
    showEditor.value = !showEditor.value
    saveToStore()
  }

  /**
   * Save current state to localStorage
   */
  function saveToStore(): void {
    const data: StoredTabsData = {
      tabs: tabs.value.map(tab => ({
        id: tab.id,
        name: tab.name,
        content: tab.content,
        createdAt: tab.createdAt
      })),
      activeTabId: activeTabId.value,
      fontSize: fontSize.value,
      showEditor: showEditor.value
    }
    saveToLocalStorage(data)
  }

  /**
   * Load state from localStorage
   */
  function loadFromStore(): boolean {
    const stored = loadFromLocalStorage()
    if (stored && stored.tabs.length > 0) {
      // Restore tab data
      tabs.value = stored.tabs.map(tab => ({
        id: tab.id,
        name: tab.name,
        content: tab.content,
        createdAt: tab.createdAt
      }))
      // Restore active tab (if exists)
      if (stored.activeTabId && tabs.value.some(t => t.id === stored.activeTabId)) {
        activeTabId.value = stored.activeTabId
      } else {
        activeTabId.value = tabs.value[0]?.id || null
      }
      // Restore font size
      if (stored.fontSize) {
        fontSize.value = Math.max(10, Math.min(24, stored.fontSize))
      }
      // Restore editor visibility
      if (stored.showEditor !== undefined) {
        showEditor.value = stored.showEditor
      }
      return true
    }
    return false
  }

  // Debounced save function (500ms delay)
  const debouncedSave = debounce(saveToStore, 500)

  // Watch for state changes and auto-save
  watch(
    [tabs, activeTabId, fontSize, showEditor],
    () => {
      // Only auto-save after initialization (avoid triggering during initial load)
      if (tabs.value.length > 0) {
        debouncedSave()
      }
    },
    { deep: true }
  )

  // Initialization: Try loading saved data, otherwise create default tab
  function initialize(): void {
    const loaded = loadFromStore()
    if (!loaded && tabs.value.length === 0) {
      addTab('Welcome')
    }
  }

  return {
    // State
    tabs,
    activeTabId,
    fontSize,
    showEditor,
    // Getters
    activeTab,
    activeTabContent,
    // Actions
    addTab,
    removeTab,
    setActiveTab,
    updateTabContent,
    renameTab,
    setFontSize,
    toggleEditor,
    initialize,
    saveToStore,
    loadFromStore
  }
})
