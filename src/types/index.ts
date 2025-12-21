export interface Tab {
  id: string
  name: string
  content: string
  createdAt: number
}

export interface TabsState {
  tabs: Tab[]
  activeTabId: string | null
  fontSize: number
}
