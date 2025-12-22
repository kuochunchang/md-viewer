/**
 * localStorage read/write logic encapsulation
 * Provides type-safe localStorage operations
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
  showEditor?: boolean
}

const STORAGE_KEY = 'markdown-mermaid-editor-data'

/**
 * Load data from localStorage
 */
export function loadFromLocalStorage(): StoredTabsData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return null
    }
    const parsed = JSON.parse(stored) as StoredTabsData
    // Validate data structure
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
 * Save data to localStorage
 */
export function saveToLocalStorage(data: StoredTabsData): void {
  try {
    const serialized = JSON.stringify(data)
    localStorage.setItem(STORAGE_KEY, serialized)
  } catch (error) {
    console.error('Failed to save to localStorage:', error)
    // If save fails (e.g., quota exceeded), try clearing old data
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (retryError) {
      console.error('Failed to save after cleanup:', retryError)
    }
  }
}

/**
 * Clear data from localStorage
 */
export function clearLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear localStorage:', error)
  }
}
