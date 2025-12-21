import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearLocalStorage,
  loadFromLocalStorage,
  saveToLocalStorage,
  type StoredTabsData
} from './useLocalStorage'

describe('useLocalStorage', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear()
    // Clear console.error mock
    vi.clearAllMocks()
  })

  describe('saveToLocalStorage', () => {
    it('should be able to save data to localStorage', () => {
      const data: StoredTabsData = {
        tabs: [
          {
            id: 'tab-1',
            name: 'Test Tab',
            content: '# Test Content',
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
      expect(parsed.tabs[0].name).toBe('Test Tab')
      expect(parsed.activeTabId).toBe('tab-1')
      expect(parsed.fontSize).toBe(14)
    })

    it('should be able to save multiple tabs', () => {
      const data: StoredTabsData = {
        tabs: [
          {
            id: 'tab-1',
            name: 'Tab 1',
            content: 'Content 1',
            createdAt: Date.now()
          },
          {
            id: 'tab-2',
            name: 'Tab 2',
            content: 'Content 2',
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

    it('should be able to handle storage failure (quota exceeded)', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

      // Mock localStorage.setItem to throw error
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError')
      })

      const data: StoredTabsData = {
        tabs: [],
        activeTabId: null,
        fontSize: 14
      }

      // Should not throw error, but catch and log it
      expect(() => saveToLocalStorage(data)).not.toThrow()

      // Restore
      Storage.prototype.setItem = originalSetItem
      consoleErrorSpy.mockRestore()
    })

    it('should try to cleanup and resave after failure', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

      const originalSetItem = Storage.prototype.setItem
      let firstCall = true

      // First setItem fails, second succeeds
      Storage.prototype.setItem = function (key: string, value: string) {
        if (firstCall) {
          firstCall = false
          throw new Error('QuotaExceededError')
        }
        // Second success, call original implementation
        return originalSetItem.call(this, key, value)
      }

      const data: StoredTabsData = {
        tabs: [],
        activeTabId: null,
        fontSize: 14
      }

      // Should not throw error, but catch and handle it
      expect(() => saveToLocalStorage(data)).not.toThrow()

      // Verify final data is indeed saved (second setItem succeeded)
      const stored = localStorage.getItem('markdown-mermaid-editor-data')
      expect(stored).not.toBeNull()

      // Restore
      Storage.prototype.setItem = originalSetItem
      consoleErrorSpy.mockRestore()
    })
  })

  describe('loadFromLocalStorage', () => {
    it('should be able to load data from localStorage', () => {
      const data: StoredTabsData = {
        tabs: [
          {
            id: 'tab-1',
            name: 'Test Tab',
            content: '# Test Content',
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
      expect(loaded!.tabs[0].name).toBe('Test Tab')
      expect(loaded!.activeTabId).toBe('tab-1')
      expect(loaded!.fontSize).toBe(14)
    })

    it('should return null when localStorage is empty', () => {
      const loaded = loadFromLocalStorage()
      expect(loaded).toBeNull()
    })

    it('should return null when data format is invalid', () => {
      localStorage.setItem('markdown-mermaid-editor-data', 'invalid json')
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

      const loaded = loadFromLocalStorage()

      expect(loaded).toBeNull()
      consoleErrorSpy.mockRestore()
    })

    it('should return null when data structure is incomplete', () => {
      // Missing tabs field
      localStorage.setItem('markdown-mermaid-editor-data', JSON.stringify({
        activeTabId: 'tab-1',
        fontSize: 14
      }))

      const loaded = loadFromLocalStorage()
      expect(loaded).toBeNull()
    })

    it('should return null when tabs is not an array', () => {
      localStorage.setItem('markdown-mermaid-editor-data', JSON.stringify({
        tabs: 'not an array',
        activeTabId: null,
        fontSize: 14
      }))

      const loaded = loadFromLocalStorage()
      expect(loaded).toBeNull()
    })

    it('should return null when fontSize is not a number', () => {
      localStorage.setItem('markdown-mermaid-editor-data', JSON.stringify({
        tabs: [],
        activeTabId: null,
        fontSize: 'not a number'
      }))

      const loaded = loadFromLocalStorage()
      expect(loaded).toBeNull()
    })

    it('should be able to handle localStorage.getItem throwing an error', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
      const originalGetItem = Storage.prototype.getItem

      Storage.prototype.getItem = vi.fn(() => {
        throw new Error('SecurityError')
      })

      const loaded = loadFromLocalStorage()

      expect(loaded).toBeNull()

      Storage.prototype.getItem = originalGetItem
      consoleErrorSpy.mockRestore()
    })

    it('should be able to load data with activeTabId as null', () => {
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
    it('should be able to clear data from localStorage', () => {
      const data: StoredTabsData = {
        tabs: [
          {
            id: 'tab-1',
            name: 'Test Tab',
            content: '# Test Content',
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

    it('should not throw error when clearing non-existent data', () => {
      expect(() => clearLocalStorage()).not.toThrow()
    })

    it('should be able to handle handle clear failure', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
      const originalRemoveItem = Storage.prototype.removeItem

      Storage.prototype.removeItem = vi.fn(() => {
        throw new Error('SecurityError')
      })

      // Should not throw error, but catch and log it
      expect(() => clearLocalStorage()).not.toThrow()

      Storage.prototype.removeItem = originalRemoveItem
      consoleErrorSpy.mockRestore()
    })
  })
})
