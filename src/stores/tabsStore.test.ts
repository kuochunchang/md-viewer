import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTabsStore } from './tabsStore'

describe('tabsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 清除 localStorage
    localStorage.clear()
  })

  it('應該能夠新增頁籤', () => {
    const store = useTabsStore()
    const tabId = store.addTab('測試頁籤')

    expect(store.tabs.length).toBe(1)
    expect(store.tabs[0].name).toBe('測試頁籤')
    expect(store.activeTabId).toBe(tabId)
  })

  it('應該能夠切換活動頁籤', () => {
    const store = useTabsStore()
    const tabId1 = store.addTab('頁籤 1')
    const tabId2 = store.addTab('頁籤 2')

    expect(store.activeTabId).toBe(tabId2)

    store.setActiveTab(tabId1)
    expect(store.activeTabId).toBe(tabId1)
  })

  it('應該能夠更新頁籤內容', () => {
    const store = useTabsStore()
    const tabId = store.addTab('測試頁籤')

    store.updateTabContent(tabId, '新的內容')
    const tab = store.tabs.find(t => t.id === tabId)
    expect(tab?.content).toBe('新的內容')
  })

  it('應該能夠重新命名頁籤', () => {
    const store = useTabsStore()
    const tabId = store.addTab('舊名稱')

    store.renameTab(tabId, '新名稱')
    const tab = store.tabs.find(t => t.id === tabId)
    expect(tab?.name).toBe('新名稱')
  })

  it('應該能夠刪除頁籤', () => {
    const store = useTabsStore()
    const tabId1 = store.addTab('頁籤 1')
    const tabId2 = store.addTab('頁籤 2')

    store.removeTab(tabId1)
    expect(store.tabs.length).toBe(1)
    expect(store.tabs[0].id).toBe(tabId2)
  })

  it('刪除最後一個頁籤時應該自動創建新頁籤', () => {
    const store = useTabsStore()
    const tabId = store.addTab('唯一頁籤')

    store.removeTab(tabId)
    expect(store.tabs.length).toBe(1)
    expect(store.activeTabId).not.toBeNull()
  })

  it('應該能夠設定字體大小', () => {
    const store = useTabsStore()
    store.setFontSize(16)
    expect(store.fontSize).toBe(16)
  })

  it('字體大小應該限制在 10-24 之間', () => {
    const store = useTabsStore()
    store.setFontSize(5)
    expect(store.fontSize).toBe(10)

    store.setFontSize(30)
    expect(store.fontSize).toBe(24)
  })

  it('activeTab computed 應該返回當前活動頁籤', () => {
    const store = useTabsStore()
    const tabId1 = store.addTab('頁籤 1')
    const tabId2 = store.addTab('頁籤 2')

    store.setActiveTab(tabId1)
    expect(store.activeTab?.id).toBe(tabId1)
    expect(store.activeTab?.name).toBe('頁籤 1')

    store.setActiveTab(tabId2)
    expect(store.activeTab?.id).toBe(tabId2)
    expect(store.activeTab?.name).toBe('頁籤 2')
  })

  it('activeTab computed 當沒有活動頁籤時應該返回 null', () => {
    const store = useTabsStore()
    expect(store.activeTab).toBeNull()
  })

  it('activeTabContent computed 應該返回當前活動頁籤的內容', () => {
    const store = useTabsStore()
    const tabId = store.addTab('測試頁籤')
    store.updateTabContent(tabId, '這是測試內容')

    expect(store.activeTabContent).toBe('這是測試內容')
  })

  it('activeTabContent computed 當沒有活動頁籤時應該返回空字串', () => {
    const store = useTabsStore()
    expect(store.activeTabContent).toBe('')
  })

  it('刪除活動頁籤時應該切換到下一個頁籤', () => {
    const store = useTabsStore()
    store.addTab('頁籤 1')
    const tabId2 = store.addTab('頁籤 2')
    const tabId3 = store.addTab('頁籤 3')

    store.setActiveTab(tabId2)
    store.removeTab(tabId2)

    // 應該切換到下一個頁籤（tabId3）
    expect(store.activeTabId).toBe(tabId3)
    expect(store.tabs.length).toBe(2)
  })

  it('刪除活動頁籤（最後一個）時應該切換到上一個頁籤', () => {
    const store = useTabsStore()
    const tabId1 = store.addTab('頁籤 1')
    const tabId2 = store.addTab('頁籤 2')

    store.setActiveTab(tabId2)
    store.removeTab(tabId2)

    // 應該切換到上一個頁籤（tabId1）
    expect(store.activeTabId).toBe(tabId1)
    expect(store.tabs.length).toBe(1)
  })

  it('刪除非活動頁籤時不應該改變活動頁籤', () => {
    const store = useTabsStore()
    const tabId1 = store.addTab('頁籤 1')
    const tabId2 = store.addTab('頁籤 2')

    store.setActiveTab(tabId1)
    store.removeTab(tabId2)

    expect(store.activeTabId).toBe(tabId1)
    expect(store.tabs.length).toBe(1)
  })

  it('setActiveTab 切換到不存在的頁籤時不應該改變活動頁籤', () => {
    const store = useTabsStore()
    const tabId1 = store.addTab('頁籤 1')

    store.setActiveTab('不存在的頁籤')
    expect(store.activeTabId).toBe(tabId1)
  })

  it('renameTab 當名稱為空時不應該更新', () => {
    const store = useTabsStore()
    const tabId = store.addTab('原始名稱')

    store.renameTab(tabId, '   ')
    const tab = store.tabs.find(t => t.id === tabId)
    expect(tab?.name).toBe('原始名稱')
  })

  it('renameTab 應該自動去除前後空白', () => {
    const store = useTabsStore()
    const tabId = store.addTab('原始名稱')

    store.renameTab(tabId, '  新名稱  ')
    const tab = store.tabs.find(t => t.id === tabId)
    expect(tab?.name).toBe('新名稱')
  })

  it('updateTabContent 更新不存在的頁籤時不應該拋出錯誤', () => {
    const store = useTabsStore()
    store.addTab('頁籤 1')

    expect(() => store.updateTabContent('不存在的頁籤', '內容')).not.toThrow()
  })

  it('應該能夠從 localStorage 載入資料', () => {
    const store = useTabsStore()
    store.addTab('頁籤 1')
    const tabId2 = store.addTab('頁籤 2')
    store.setActiveTab(tabId2)
    store.setFontSize(16)

    // 創建新的 store 實例來測試載入
    const newStore = useTabsStore()
    newStore.loadFromStore()

    expect(newStore.tabs.length).toBe(2)
    expect(newStore.tabs[0].name).toBe('頁籤 1')
    expect(newStore.tabs[1].name).toBe('頁籤 2')
    expect(newStore.activeTabId).toBe(tabId2)
    expect(newStore.fontSize).toBe(16)
  })

  it('loadFromStore 當 localStorage 為空時應該返回 false', () => {
    const store = useTabsStore()
    localStorage.clear()

    const result = store.loadFromStore()
    expect(result).toBe(false)
  })

  it('loadFromStore 當活動頁籤不存在時應該切換到第一個頁籤', () => {
    const store = useTabsStore()
    const tabId1 = store.addTab('頁籤 1')
    store.addTab('頁籤 2')

    // 手動設置 localStorage 中的 activeTabId 為不存在的 ID
    const data = {
      tabs: store.tabs.map(tab => ({
        id: tab.id,
        name: tab.name,
        content: tab.content,
        createdAt: tab.createdAt
      })),
      activeTabId: '不存在的頁籤',
      fontSize: 14
    }
    localStorage.setItem('markdown-mermaid-editor-data', JSON.stringify(data))

    const newStore = useTabsStore()
    const result = newStore.loadFromStore()

    expect(result).toBe(true)
    expect(newStore.activeTabId).toBe(tabId1)
  })

  it('loadFromStore 應該限制字體大小在 10-24 之間', () => {
    // 設置超出範圍的字體大小（需要至少一個 tab，否則 loadFromStore 不會載入）
    const data = {
      tabs: [
        {
          id: 'tab-1',
          name: '測試頁籤',
          content: '內容',
          createdAt: Date.now()
        }
      ],
      activeTabId: 'tab-1',
      fontSize: 5 // 小於 10
    }
    localStorage.setItem('markdown-mermaid-editor-data', JSON.stringify(data))

    const newStore = useTabsStore()
    newStore.loadFromStore()

    expect(newStore.fontSize).toBe(10)

    // 測試大於 24 的情況
    data.fontSize = 30
    localStorage.setItem('markdown-mermaid-editor-data', JSON.stringify(data))

    const newStore2 = useTabsStore()
    newStore2.loadFromStore()

    expect(newStore2.fontSize).toBe(24)
  })

  it('saveToStore 應該能夠儲存當前狀態到 localStorage', () => {
    const store = useTabsStore()
    store.addTab('頁籤 1')
    const tabId2 = store.addTab('頁籤 2')
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

  it('initialize 當沒有儲存資料時應該創建預設頁籤', () => {
    localStorage.clear()
    const store = useTabsStore()
    
    store.initialize()

    expect(store.tabs.length).toBe(1)
    expect(store.tabs[0].name).toBe('歡迎使用')
    expect(store.activeTabId).not.toBeNull()
  })

  it('initialize 當有儲存資料時應該載入資料而不創建新頁籤', () => {
    const store = useTabsStore()
    store.addTab('已存在的頁籤')
    store.setFontSize(16)

    const newStore = useTabsStore()
    newStore.initialize()

    expect(newStore.tabs.length).toBe(1)
    expect(newStore.tabs[0].name).toBe('已存在的頁籤')
    expect(newStore.fontSize).toBe(16)
  })

  it('addTab 不提供名稱時應該使用預設名稱', () => {
    const store = useTabsStore()
    store.addTab()

    expect(store.tabs[0].name).toBe('新文件 1')
    
    store.addTab()
    expect(store.tabs[1].name).toBe('新文件 2')
  })

  it('removeTab 刪除不存在的頁籤時不應該拋出錯誤', () => {
    const store = useTabsStore()
    store.addTab('頁籤 1')

    expect(() => store.removeTab('不存在的頁籤')).not.toThrow()
    expect(store.tabs.length).toBe(1)
  })
})
