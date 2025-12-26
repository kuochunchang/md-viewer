export interface Tab {
  id: string
  name: string
  content: string
  createdAt: number
  folderId: string | null  // null means root level
}

export interface Folder {
  id: string
  name: string
  parentId: string | null  // null means root level folder
  createdAt: number
  expanded: boolean
}

export interface TabsState {
  tabs: Tab[]
  folders: Folder[]
  activeTabId: string | null
  fontSize: number
}
