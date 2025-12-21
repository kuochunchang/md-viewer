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
      name: name || `新文件 ${tabs.value.length + 1}`,
      content: isFirstTab ? DEFAULT_CONTENT : '', // 只有第一個頁籤使用範本，之後的都為空白
      createdAt: Date.now()
    }
    tabs.value.push(newTab)
    activeTabId.value = newTab.id
    // 新增頁籤後立即儲存（不使用防抖）
    saveToStore()
    return newTab.id
  }

  function removeTab(id: string): void {
    const index = tabs.value.findIndex(tab => tab.id === id)
    if (index === -1) return

    tabs.value.splice(index, 1)

    // 如果刪除的是當前活動頁籤，切換到其他頁籤
    if (activeTabId.value === id) {
      if (tabs.value.length > 0) {
        // 優先選擇下一個頁籤，如果沒有則選擇上一個
        const nextIndex = index < tabs.value.length ? index : index - 1
        activeTabId.value = tabs.value[nextIndex]?.id || tabs.value[0]?.id || null
      } else {
        activeTabId.value = null
        // 如果沒有頁籤了，自動創建一個新頁籤
        addTab()
        return // addTab 已經會觸發儲存
      }
    }
    // 刪除頁籤後立即儲存（不使用防抖）
    saveToStore()
  }

  function setActiveTab(id: string): void {
    if (tabs.value.some(tab => tab.id === id)) {
      activeTabId.value = id
      // 切換頁籤後立即儲存（不使用防抖）
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
      // 重新命名後立即儲存（不使用防抖）
      saveToStore()
    }
  }

  function setFontSize(size: number): void {
    fontSize.value = Math.max(10, Math.min(24, size)) // 限制在 10-24 之間
    saveToStore()
  }

  /**
   * 儲存當前狀態至 localStorage
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
      fontSize: fontSize.value
    }
    saveToLocalStorage(data)
  }

  /**
   * 從 localStorage 載入狀態
   */
  function loadFromStore(): boolean {
    const stored = loadFromLocalStorage()
    if (stored && stored.tabs.length > 0) {
      // 恢復頁籤資料
      tabs.value = stored.tabs.map(tab => ({
        id: tab.id,
        name: tab.name,
        content: tab.content,
        createdAt: tab.createdAt
      }))
      // 恢復活動頁籤（如果存在）
      if (stored.activeTabId && tabs.value.some(t => t.id === stored.activeTabId)) {
        activeTabId.value = stored.activeTabId
      } else {
        activeTabId.value = tabs.value[0]?.id || null
      }
      // 恢復字體大小
      if (stored.fontSize) {
        fontSize.value = Math.max(10, Math.min(24, stored.fontSize))
      }
      return true
    }
    return false
  }

  // 使用防抖的儲存函數（500ms 延遲）
  const debouncedSave = debounce(saveToStore, 500)

  // 監聽狀態變化，自動儲存
  watch(
    [tabs, activeTabId, fontSize],
    () => {
      // 只有在已經初始化後才自動儲存（避免初始化時觸發）
      if (tabs.value.length > 0) {
        debouncedSave()
      }
    },
    { deep: true }
  )

  // 初始化：先嘗試載入儲存的資料，如果沒有則創建預設頁籤
  function initialize(): void {
    const loaded = loadFromStore()
    if (!loaded && tabs.value.length === 0) {
      addTab('歡迎使用')
    }
  }

  return {
    // State
    tabs,
    activeTabId,
    fontSize,
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
    initialize,
    saveToStore,
    loadFromStore
  }
})
