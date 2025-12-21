import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadFromLocalStorage,
  saveToLocalStorage,
  clearLocalStorage,
  type StoredTabsData
} from './useLocalStorage'

describe('useLocalStorage', () => {
  beforeEach(() => {
    // 清除 localStorage
    localStorage.clear()
    // 清除 console.error 的 mock
    vi.clearAllMocks()
  })

  describe('saveToLocalStorage', () => {
    it('應該能夠儲存資料到 localStorage', () => {
      const data: StoredTabsData = {
        tabs: [
          {
            id: 'tab-1',
            name: '測試頁籤',
            content: '# 測試內容',
            createdAt: Date.now()
          }
        ],
        activeTabId: 'tab-1',
        fontSize: 14
      }

      saveToLocalStorage(data)

      const stored = localStorage.getItem('markdown-mermaid-editor-data')
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!)
      expect(parsed.tabs).toHaveLength(1)
      expect(parsed.tabs[0].name).toBe('測試頁籤')
      expect(parsed.activeTabId).toBe('tab-1')
      expect(parsed.fontSize).toBe(14)
    })

    it('應該能夠儲存多個頁籤', () => {
      const data: StoredTabsData = {
        tabs: [
          {
            id: 'tab-1',
            name: '頁籤 1',
            content: '內容 1',
            createdAt: Date.now()
          },
          {
            id: 'tab-2',
            name: '頁籤 2',
            content: '內容 2',
            createdAt: Date.now()
          }
        ],
        activeTabId: 'tab-2',
        fontSize: 16
      }

      saveToLocalStorage(data)

      const stored = localStorage.getItem('markdown-mermaid-editor-data')
      const parsed = JSON.parse(stored!)
      expect(parsed.tabs).toHaveLength(2)
    })

    it('應該能夠處理儲存失敗的情況（空間不足）', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      // Mock localStorage.setItem 拋出錯誤
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError')
      })

      const data: StoredTabsData = {
        tabs: [],
        activeTabId: null,
        fontSize: 14
      }

      // 應該不會拋出錯誤，而是捕獲並記錄
      expect(() => saveToLocalStorage(data)).not.toThrow()
      
      // 恢復
      Storage.prototype.setItem = originalSetItem
      consoleErrorSpy.mockRestore()
    })

    it('應該在儲存失敗後嘗試清理並重新儲存', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const originalSetItem = Storage.prototype.setItem
      let firstCall = true
      
      // 第一次 setItem 失敗，第二次成功
      Storage.prototype.setItem = function(key: string, value: string) {
        if (firstCall) {
          firstCall = false
          throw new Error('QuotaExceededError')
        }
        // 第二次成功，調用原始實現
        return originalSetItem.call(this, key, value)
      }

      const data: StoredTabsData = {
        tabs: [],
        activeTabId: null,
        fontSize: 14
      }

      // 應該不會拋出錯誤，而是捕獲並處理
      expect(() => saveToLocalStorage(data)).not.toThrow()
      
      // 驗證最終資料確實被儲存（第二次 setItem 成功）
      const stored = localStorage.getItem('markdown-mermaid-editor-data')
      expect(stored).not.toBeNull()
      
      // 恢復
      Storage.prototype.setItem = originalSetItem
      consoleErrorSpy.mockRestore()
    })
  })

  describe('loadFromLocalStorage', () => {
    it('應該能夠從 localStorage 讀取資料', () => {
      const data: StoredTabsData = {
        tabs: [
          {
            id: 'tab-1',
            name: '測試頁籤',
            content: '# 測試內容',
            createdAt: Date.now()
          }
        ],
        activeTabId: 'tab-1',
        fontSize: 14
      }

      localStorage.setItem('markdown-mermaid-editor-data', JSON.stringify(data))
      const loaded = loadFromLocalStorage()

      expect(loaded).not.toBeNull()
      expect(loaded!.tabs).toHaveLength(1)
      expect(loaded!.tabs[0].name).toBe('測試頁籤')
      expect(loaded!.activeTabId).toBe('tab-1')
      expect(loaded!.fontSize).toBe(14)
    })

    it('當 localStorage 為空時應該返回 null', () => {
      const loaded = loadFromLocalStorage()
      expect(loaded).toBeNull()
    })

    it('當資料格式無效時應該返回 null', () => {
      localStorage.setItem('markdown-mermaid-editor-data', 'invalid json')
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const loaded = loadFromLocalStorage()
      
      expect(loaded).toBeNull()
      consoleErrorSpy.mockRestore()
    })

    it('當資料結構不完整時應該返回 null', () => {
      // 缺少 tabs 欄位
      localStorage.setItem('markdown-mermaid-editor-data', JSON.stringify({
        activeTabId: 'tab-1',
        fontSize: 14
      }))
      
      const loaded = loadFromLocalStorage()
      expect(loaded).toBeNull()
    })

    it('當 tabs 不是陣列時應該返回 null', () => {
      localStorage.setItem('markdown-mermaid-editor-data', JSON.stringify({
        tabs: 'not an array',
        activeTabId: null,
        fontSize: 14
      }))
      
      const loaded = loadFromLocalStorage()
      expect(loaded).toBeNull()
    })

    it('當 fontSize 不是數字時應該返回 null', () => {
      localStorage.setItem('markdown-mermaid-editor-data', JSON.stringify({
        tabs: [],
        activeTabId: null,
        fontSize: 'not a number'
      }))
      
      const loaded = loadFromLocalStorage()
      expect(loaded).toBeNull()
    })

    it('應該能夠處理 localStorage.getItem 拋出錯誤的情況', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const originalGetItem = Storage.prototype.getItem
      
      Storage.prototype.getItem = vi.fn(() => {
        throw new Error('SecurityError')
      })

      const loaded = loadFromLocalStorage()
      
      expect(loaded).toBeNull()
      
      Storage.prototype.getItem = originalGetItem
      consoleErrorSpy.mockRestore()
    })

    it('應該能夠讀取 activeTabId 為 null 的資料', () => {
      const data: StoredTabsData = {
        tabs: [],
        activeTabId: null,
        fontSize: 14
      }

      localStorage.setItem('markdown-mermaid-editor-data', JSON.stringify(data))
      const loaded = loadFromLocalStorage()

      expect(loaded).not.toBeNull()
      expect(loaded!.activeTabId).toBeNull()
    })
  })

  describe('clearLocalStorage', () => {
    it('應該能夠清除 localStorage 中的資料', () => {
      const data: StoredTabsData = {
        tabs: [
          {
            id: 'tab-1',
            name: '測試頁籤',
            content: '# 測試內容',
            createdAt: Date.now()
          }
        ],
        activeTabId: 'tab-1',
        fontSize: 14
      }

      localStorage.setItem('markdown-mermaid-editor-data', JSON.stringify(data))
      expect(localStorage.getItem('markdown-mermaid-editor-data')).not.toBeNull()

      clearLocalStorage()

      expect(localStorage.getItem('markdown-mermaid-editor-data')).toBeNull()
    })

    it('當資料不存在時清除不應該拋出錯誤', () => {
      expect(() => clearLocalStorage()).not.toThrow()
    })

    it('應該能夠處理清除失敗的情況', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const originalRemoveItem = Storage.prototype.removeItem
      
      Storage.prototype.removeItem = vi.fn(() => {
        throw new Error('SecurityError')
      })

      // 應該不會拋出錯誤，而是捕獲並記錄
      expect(() => clearLocalStorage()).not.toThrow()
      
      Storage.prototype.removeItem = originalRemoveItem
      consoleErrorSpy.mockRestore()
    })
  })
})
