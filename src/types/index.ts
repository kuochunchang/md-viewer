export interface Tab {
  id: string
  name: string
  content: string
  createdAt: number
  folderId: string | null  // null means root level
  filePath?: string // For local file system integration
}

export interface Folder {
  id: string
  name: string
  parentId: string | null  // null means root level folder
  createdAt: number
  expanded: boolean
}

// History state for undo/redo functionality (per-tab, not persisted)
export interface HistoryState {
  content: string
  cursorPos: number
}

export interface TabHistory {
  stack: HistoryState[]
  index: number
}

export interface TabsState {
  tabs: Tab[]
  folders: Folder[]
  activeTabId: string | null
  fontSize: number
}
