import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  loadFromLocalStorage,
  saveToLocalStorage,
  type StoredTabsData
} from '../composables/useLocalStorage'
import type { Tab, Folder } from '../types'
import { debounce } from '../utils/debounce'
import { DEFAULT_CONTENT } from '../utils/defaultContent'

export const useTabsStore = defineStore('tabs', () => {
  // State
  const tabs = ref<Tab[]>([])
  const folders = ref<Folder[]>([])
  const openTabIds = ref<string[]>([])
  const activeTabId = ref<string | null>(null)
  const fontSize = ref<number>(14)
  const showEditor = ref<boolean>(true)
  const showSidebar = ref<boolean>(true)

  // Editing state (global to ensure only one item is being edited at a time)
  const editingItemId = ref<string | null>(null)
  const editingItemType = ref<'file' | 'folder' | null>(null)

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

  // Folder getters
  const rootFolders = computed(() => {
    return folders.value.filter(f => f.parentId === null)
  })

  const rootTabs = computed(() => {
    return tabs.value.filter(t => t.folderId === null)
  })

  function getChildFolders(parentId: string): Folder[] {
    return folders.value.filter(f => f.parentId === parentId)
  }

  function getTabsInFolder(folderId: string): Tab[] {
    return tabs.value.filter(t => t.folderId === folderId)
  }

  // Actions
  function addTab(name?: string, folderId?: string | null): string {
    const isFirstTab = tabs.value.length === 0
    const newTab: Tab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: name || `New Document ${tabs.value.length + 1}`,
      content: isFirstTab ? DEFAULT_CONTENT : '', // Only the first tab uses the template, others are blank
      createdAt: Date.now(),
      folderId: folderId ?? null
    }
    tabs.value.push(newTab)
    openTabIds.value.push(newTab.id)
    activeTabId.value = newTab.id
    saveToStore()
    return newTab.id
  }

  function addFolder(name?: string, parentId?: string | null): string {
    const newFolder: Folder = {
      id: `folder-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: name || `New Folder ${folders.value.length + 1}`,
      parentId: parentId ?? null,
      createdAt: Date.now(),
      expanded: true
    }
    folders.value.push(newFolder)
    saveToStore()
    return newFolder.id
  }

  function renameFolder(id: string, name: string): void {
    const folder = folders.value.find(f => f.id === id)
    if (folder && name.trim()) {
      folder.name = name.trim()
      saveToStore()
    }
  }

  function deleteFolder(id: string): void {
    // Move all files in this folder to root
    tabs.value.forEach(tab => {
      if (tab.folderId === id) {
        tab.folderId = null
      }
    })

    // Move all child folders to root
    folders.value.forEach(folder => {
      if (folder.parentId === id) {
        folder.parentId = null
      }
    })

    // Remove the folder
    const index = folders.value.findIndex(f => f.id === id)
    if (index !== -1) {
      folders.value.splice(index, 1)
    }
    saveToStore()
  }

  function toggleFolderExpanded(id: string): void {
    const folder = folders.value.find(f => f.id === id)
    if (folder) {
      folder.expanded = !folder.expanded
      saveToStore()
    }
  }

  function moveTabToFolder(tabId: string, folderId: string | null): void {
    const tab = tabs.value.find(t => t.id === tabId)
    if (tab) {
      tab.folderId = folderId
      saveToStore()
    }
  }

  function moveFolderToFolder(folderId: string, parentId: string | null): void {
    const folder = folders.value.find(f => f.id === folderId)
    if (folder) {
      // Prevent moving folder into itself or its children
      if (parentId && isDescendantFolder(parentId, folderId)) {
        return
      }
      folder.parentId = parentId
      saveToStore()
    }
  }

  function isDescendantFolder(targetId: string, ancestorId: string): boolean {
    let current = folders.value.find(f => f.id === targetId)
    while (current) {
      if (current.id === ancestorId) return true
      if (!current.parentId) return false
      current = folders.value.find(f => f.id === current!.parentId)
    }
    return false
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
      folders: folders.value,
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
      // Load tabs with backward compatibility for folderId
      tabs.value = stored.tabs.map(t => ({
        ...t,
        folderId: t.folderId ?? null
      }))

      // Load folders (if exists)
      if (stored.folders && Array.isArray(stored.folders)) {
        folders.value = stored.folders
      } else {
        folders.value = []
      }

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
    [tabs, folders, activeTabId, openTabIds, fontSize, showEditor, showSidebar],
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

  // Editing functions
  function startEditing(id: string, type: 'file' | 'folder') {
    editingItemId.value = id
    editingItemType.value = type
  }

  function stopEditing() {
    editingItemId.value = null
    editingItemType.value = null
  }

  function isEditing(id: string): boolean {
    return editingItemId.value === id
  }

  // Load data from external source (e.g., cloud sync)
  function loadFromData(data: StoredTabsData): boolean {
    if (!data || !data.tabs || data.tabs.length === 0) {
      return false
    }

    try {
      // Load tabs with backward compatibility for folderId
      tabs.value = data.tabs.map(t => ({
        ...t,
        folderId: t.folderId ?? null
      }))

      // Load folders (if exists)
      if (data.folders && Array.isArray(data.folders)) {
        folders.value = data.folders
      } else {
        folders.value = []
      }

      // Restore open tabs
      if (data.openTabIds && Array.isArray(data.openTabIds)) {
        openTabIds.value = data.openTabIds.filter(id => tabs.value.some(t => t.id === id))
      } else {
        openTabIds.value = tabs.value.map(t => t.id)
      }

      // Restore active tab
      if (data.activeTabId && tabs.value.some(t => t.id === data.activeTabId)) {
        activeTabId.value = data.activeTabId
      } else {
        activeTabId.value = openTabIds.value[0] || tabs.value[0]?.id || null
      }

      if (data.fontSize) {
        fontSize.value = Math.max(10, Math.min(24, data.fontSize))
      }

      if (data.showEditor !== undefined) {
        showEditor.value = data.showEditor
      }

      if (data.showSidebar !== undefined) {
        showSidebar.value = data.showSidebar
      }

      // Save to local storage as well
      saveToStore()

      return true
    } catch (error) {
      console.error('Failed to load from external data:', error)
      return false
    }
  }

  // Get current data for export (e.g., cloud sync)
  function getDataForExport(): StoredTabsData {
    return {
      tabs: tabs.value,
      folders: folders.value,
      activeTabId: activeTabId.value,
      openTabIds: openTabIds.value,
      fontSize: fontSize.value,
      showSidebar: showSidebar.value,
      showEditor: showEditor.value
    }
  }

  return {
    tabs,
    folders,
    openTabIds,
    activeTabId,
    fontSize,
    showEditor,
    showSidebar,
    editingItemId,
    editingItemType,
    activeTab,
    activeTabContent,
    openTabs,
    rootFolders,
    rootTabs,
    getChildFolders,
    getTabsInFolder,
    addTab,
    addFolder,
    renameFolder,
    deleteFolder,
    toggleFolderExpanded,
    moveTabToFolder,
    moveFolderToFolder,
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
    loadFromStore,
    loadFromData,
    getDataForExport,
    startEditing,
    stopEditing,
    isEditing,
    reorderTabs: (fromIndex: number, toIndex: number) => {
      const item = openTabIds.value.splice(fromIndex, 1)[0]
      openTabIds.value.splice(toIndex, 0, item)
      saveToStore()
    }
  }
})
