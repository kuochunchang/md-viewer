/**
 * localStorage 讀寫邏輯封裝
 * 提供型別安全的 localStorage 操作
 */

export interface StoredTabsData {
  tabs: Array<{
    id: string
    name: string
    content: string
    createdAt: number
  }>
  activeTabId: string | null
  fontSize: number
}

const STORAGE_KEY = 'markdown-mermaid-editor-data'

/**
 * 從 localStorage 讀取資料
 */
export function loadFromLocalStorage(): StoredTabsData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return null
    }
    const parsed = JSON.parse(stored) as StoredTabsData
    // 驗證資料結構
    if (
      parsed &&
      Array.isArray(parsed.tabs) &&
      typeof parsed.fontSize === 'number'
    ) {
      return parsed
    }
    return null
  } catch (error) {
    console.error('Failed to load from localStorage:', error)
    return null
  }
}

/**
 * 儲存資料至 localStorage
 */
export function saveToLocalStorage(data: StoredTabsData): void {
  try {
    const serialized = JSON.stringify(data)
    localStorage.setItem(STORAGE_KEY, serialized)
  } catch (error) {
    console.error('Failed to save to localStorage:', error)
    // 如果儲存失敗（例如空間不足），嘗試清理舊資料
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (retryError) {
      console.error('Failed to save after cleanup:', retryError)
    }
  }
}

/**
 * 清除 localStorage 中的資料
 */
export function clearLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear localStorage:', error)
  }
}
