import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useTabsStore } from './tabsStore'

describe('tabsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Clear localStorage
    localStorage.clear()
  })

  it('should be able to add a tab', () => {
    const store = useTabsStore()
    const tabId = store.addTab('Test Tab')

    expect(store.tabs.length).toBe(1)
    expect(store.tabs[0].name).toBe('Test Tab')
    expect(store.activeTabId).toBe(tabId)
    expect(store.openTabIds).toContain(tabId)
  })

  it('should be able to switch active tab', () => {
    const store = useTabsStore()
    const tabId1 = store.addTab('Tab 1')
    const tabId2 = store.addTab('Tab 2')

    expect(store.activeTabId).toBe(tabId2)

    store.setActiveTab(tabId1)
    expect(store.activeTabId).toBe(tabId1)
  })

  it('should be able to update tab content', () => {
    const store = useTabsStore()
    const tabId = store.addTab('Test Tab')

    store.updateTabContent(tabId, 'new content')
    const tab = store.tabs.find(t => t.id === tabId)
    expect(tab?.content).toBe('new content')
  })

  it('should be able to rename a tab', () => {
    const store = useTabsStore()
    const tabId = store.addTab('old name')

    store.renameTab(tabId, 'new name')
    const tab = store.tabs.find(t => t.id === tabId)
    expect(tab?.name).toBe('new name')
  })

  it('should be able to delete a file', () => {
    const store = useTabsStore()
    const tabId1 = store.addTab('Tab 1')
    const tabId2 = store.addTab('Tab 2')

    store.deleteFile(tabId1)
    expect(store.tabs.length).toBe(1)
    expect(store.tabs[0].id).toBe(tabId2)
  })

  it('should be able to close a tab without deleting the file', () => {
    const store = useTabsStore()
    const tabId1 = store.addTab('Tab 1')

    store.closeTab(tabId1)
    expect(store.tabs.length).toBe(1)
    expect(store.openTabIds.length).toBe(0)
  })

  it('should automatically create a new tab when the last file is deleted', () => {
    const store = useTabsStore()
    const tabId = store.addTab('Only Tab')

    store.deleteFile(tabId)
    expect(store.tabs.length).toBe(1)
    expect(store.activeTabId).not.toBeNull()
  })

  it('should be able to set font size', () => {
    const store = useTabsStore()
    store.setFontSize(16)
    expect(store.fontSize).toBe(16)
  })

  it('font size should be restricted between 10-24', () => {
    const store = useTabsStore()
    store.setFontSize(5)
    expect(store.fontSize).toBe(10)

    store.setFontSize(30)
    expect(store.fontSize).toBe(24)
  })

  it('activeTab computed should return the current active tab', () => {
    const store = useTabsStore()
    const tabId1 = store.addTab('Tab 1')
    const tabId2 = store.addTab('Tab 2')

    store.setActiveTab(tabId1)
    expect(store.activeTab?.id).toBe(tabId1)
    expect(store.activeTab?.name).toBe('Tab 1')

    store.setActiveTab(tabId2)
    expect(store.activeTab?.id).toBe(tabId2)
    expect(store.activeTab?.name).toBe('Tab 2')
  })

  it('activeTab computed should return null when there is no active tab', () => {
    const store = useTabsStore()
    expect(store.activeTab).toBeNull()
  })

  it('activeTabContent computed should return the content of the current active tab', () => {
    const store = useTabsStore()
    const tabId = store.addTab('Test Tab')
    store.updateTabContent(tabId, 'this is test content')

    expect(store.activeTabContent).toBe('this is test content')
  })

  it('activeTabContent computed should return empty string when there is no active tab', () => {
    const store = useTabsStore()
    expect(store.activeTabContent).toBe('')
  })

  it('should switch to the next open tab when the active tab is closed', () => {
    const store = useTabsStore()
    store.addTab('Tab 1')
    const tabId2 = store.addTab('Tab 2')
    const tabId3 = store.addTab('Tab 3')

    store.setActiveTab(tabId2)
    store.closeTab(tabId2)

    // Should switch to the next open tab (tabId3)
    expect(store.activeTabId).toBe(tabId3)
    expect(store.openTabIds.length).toBe(2)
  })

  it('should switch to the previous open tab when the last active tab is closed', () => {
    const store = useTabsStore()
    const tabId1 = store.addTab('Tab 1')
    const tabId2 = store.addTab('Tab 2')

    store.setActiveTab(tabId2)
    store.closeTab(tabId2)

    // Should switch to the previous open tab (tabId1)
    expect(store.activeTabId).toBe(tabId1)
    expect(store.openTabIds.length).toBe(1)
  })

  it('should not change the active tab when a non-active tab is closed', () => {
    const store = useTabsStore()
    const tabId1 = store.addTab('Tab 1')
    const tabId2 = store.addTab('Tab 2')

    store.setActiveTab(tabId1)
    store.closeTab(tabId2)

    expect(store.activeTabId).toBe(tabId1)
    expect(store.openTabIds.length).toBe(1)
  })

  it('setActiveTab should not change the active tab when switching to a non-existent tab', () => {
    const store = useTabsStore()
    const tabId1 = store.addTab('Tab 1')

    store.setActiveTab('non-existent tab')
    expect(store.activeTabId).toBe(tabId1)
  })

  it('renameTab should not update when name is empty', () => {
    const store = useTabsStore()
    const tabId = store.addTab('original name')

    store.renameTab(tabId, '   ')
    const tab = store.tabs.find(t => t.id === tabId)
    expect(tab?.name).toBe('original name')
  })

  it('renameTab should automatically trim whitespace', () => {
    const store = useTabsStore()
    const tabId = store.addTab('original name')

    store.renameTab(tabId, '  new name  ')
    const tab = store.tabs.find(t => t.id === tabId)
    expect(tab?.name).toBe('new name')
  })

  it('updateTabContent should not throw error when updating a non-existent tab', () => {
    const store = useTabsStore()
    store.addTab('Tab 1')

    expect(() => store.updateTabContent('non-existent tab', 'content')).not.toThrow()
  })

  it('should be able to load data from localStorage', () => {
    const store = useTabsStore()
    store.addTab('Tab 1')
    const tabId2 = store.addTab('Tab 2')
    store.setActiveTab(tabId2)
    store.setFontSize(16)

    // Create a new store instance to test loading
    const newStore = useTabsStore()
    newStore.loadFromStore()

    expect(newStore.tabs.length).toBe(2)
    expect(newStore.tabs[0].name).toBe('Tab 1')
    expect(newStore.tabs[1].name).toBe('Tab 2')
    expect(newStore.activeTabId).toBe(tabId2)
    expect(newStore.fontSize).toBe(16)
  })

  it('loadFromStore should return false when localStorage is empty', () => {
    const store = useTabsStore()
    localStorage.clear()

    const result = store.loadFromStore()
    expect(result).toBe(false)
  })

  it('loadFromStore should switch to the first tab when the active tab does not exist', () => {
    const store = useTabsStore()
    const tabId1 = store.addTab('Tab 1')
    store.addTab('Tab 2')

    // Manually set activeTabId to a non-existent ID in localStorage
    const data = {
      tabs: store.tabs.map(tab => ({
        id: tab.id,
        name: tab.name,
        content: tab.content,
        createdAt: tab.createdAt
      })),
      activeTabId: 'non-existent tab',
      openTabIds: store.tabs.map(t => t.id),
      fontSize: 14
    }
    localStorage.setItem('markdown-mermaid-editor-data', JSON.stringify(data))

    const newStore = useTabsStore()
    const result = newStore.loadFromStore()

    expect(result).toBe(true)
    expect(newStore.activeTabId).toBe(tabId1)
  })

  it('loadFromStore should restrict font size between 10-24', () => {
    // Set out-of-range font size (at least one tab is needed, otherwise loadFromStore won't load)
    const data = {
      tabs: [
        {
          id: 'tab-1',
          name: 'Test Tab',
          content: 'content',
          createdAt: Date.now()
        }
      ],
      activeTabId: 'tab-1',
      openTabIds: ['tab-1'],
      fontSize: 5 // less than 10
    }
    localStorage.setItem('markdown-mermaid-editor-data', JSON.stringify(data))

    const newStore = useTabsStore()
    newStore.loadFromStore()

    expect(newStore.fontSize).toBe(10)

    // Test case for greater than 24
    data.fontSize = 30
    localStorage.setItem('markdown-mermaid-editor-data', JSON.stringify(data))

    const newStore2 = useTabsStore()
    newStore2.loadFromStore()

    expect(newStore2.fontSize).toBe(24)
  })

  it('saveToStore should be able to save the current state to localStorage', () => {
    const store = useTabsStore()
    store.addTab('Tab 1')
    const tabId2 = store.addTab('Tab 2')
    store.setActiveTab(tabId2)
    store.setFontSize(18)

    store.saveToStore()

    const stored = localStorage.getItem('markdown-mermaid-editor-data')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.tabs).toHaveLength(2)
    expect(parsed.activeTabId).toBe(tabId2)
    expect(parsed.fontSize).toBe(18)
  })

  it('initialize should create a default tab when no data is saved', () => {
    localStorage.clear()
    const store = useTabsStore()

    store.initialize()

    expect(store.tabs.length).toBe(1)
    expect(store.tabs[0].name).toBe('Welcome')
    expect(store.activeTabId).not.toBeNull()
  })

  it('initialize should load data without creating a new tab when data exists', () => {
    const store = useTabsStore()
    store.addTab('Existing Tab')
    store.setFontSize(16)

    const newStore = useTabsStore()
    newStore.initialize()

    expect(newStore.tabs.length).toBe(1)
    expect(newStore.tabs[0].name).toBe('Existing Tab')
    expect(newStore.fontSize).toBe(16)
  })

  it('addTab should use default name when no name is provided', () => {
    const store = useTabsStore()
    store.addTab()

    expect(store.tabs[0].name).toBe('New Document 1')

    store.addTab()
    expect(store.tabs[1].name).toBe('New Document 2')
  })

  it('deleteFile should not throw error when removing a non-existent tab', () => {
    const store = useTabsStore()
    store.addTab('Tab 1')

    expect(() => store.deleteFile('non-existent tab')).not.toThrow()
    expect(store.tabs.length).toBe(1)
  })
})
