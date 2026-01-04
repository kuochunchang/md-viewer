# Obsidian 整合方案與架構規劃書 (Obsidian Integration Plan)

**日期**: 2026-01-03  
**專案**: md-viewer (Markdown & Mermaid Viewer)  
**目標**: 實現 Web 端應用程式與本地 Obsidian Vault 的無縫協作

---

## 1. 核心願景 (Vision)

將 `md-viewer` 定位為 Obsidian 的 **「AI 增強型衛星編輯器」 (AI-Enhanced Satellite Editor)**。

*   **Obsidian (主體)**：負責知識管理、長期歸檔、雙向連結 (Backlinks) 與圖譜 (Graph)。
*   **md-viewer (衛星)**：負責 AI 輔助寫作、快速發散思考、Mermaid 圖表繪製與即時預覽。

透過瀏覽器的 **File System Access API**，讓 `md-viewer` 能直接讀寫使用者硬碟上的 Obsidian 筆記庫，達成「零複製同步」。

---

## 2. 推薦技術方案：File System Access API

我們不使用傳統的「上傳/下載」模式，而是採用現代瀏覽器標準的檔案系統存取介面。

### 2.1 優勢
1.  **即時同步**：在 `md-viewer` 按下 Ctrl+S，Obsidian 內對應的檔案即刻更新，無需手動匯出。
2.  **安全性**：基於瀏覽器沙盒，使用者明確授權特定資料夾（Vault），不會讀取其他硬碟內容。
3.  **無縫切換**：使用者可以在 Obsidian 整理架構，切換到 `md-viewer` 使用 Gemini AI 擴寫，再切回 Obsidian 查看結果。

### 2.2 限制
*   **瀏覽器支援**：主要支援 Chrome、Edge、Opera 等 Chromium 核心瀏覽器（Firefox 與 Safari 支援度較有限）。
*   **HTTPS 需求**：部署到線上時必須使用 HTTPS（本機 `localhost` 開發不受此限）。

---

## 3. 實作架構 (Architecture Plan)

### 3.1 新增核心模組 (`composables/useFileSystem.ts`)

我們需要一個新的 Composable 來管理與本地檔案系統的互動。

```typescript
// 概念代碼 (Pseudo-code)

export interface FileSystemEntry {
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  path: string;
  kind: 'file' | 'directory';
}

export const useFileSystem = () => {
  const rootHandle = ref<FileSystemDirectoryHandle | null>(null);

  // 1. 開啟本地 Vault
  const openVault = async () => {
    try {
      const handle = await window.showDirectoryPicker();
      rootHandle.value = handle;
      // 遞迴讀取檔案結構...
    } catch (err) {
      console.error('User cancelled or API not supported');
    }
  };

  // 2. 讀取檔案內容
  const readFile = async (fileHandle: FileSystemFileHandle) => {
    const file = await fileHandle.getFile();
    return await file.text();
  };

  // 3. 寫入檔案 (直接覆寫本地檔案)
  const saveFile = async (fileHandle: FileSystemFileHandle, content: string) => {
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  };

  return { openVault, readFile, saveFile, rootHandle };
};
```

### 3.2 狀態管理調整 (`stores/fileSystemStore.ts`)

建立一個新的 Pinia Store 來管理目前的「模式」：
*   **Mode**: `browser` (存 LocalStorage) vs `local-fs` (存硬碟)。
*   **Current Handle**: 保存當前開啟的檔案 Handle，以便自動存檔。

### 3.3 UI 介面整合

1.  **側邊欄 (FolderTree.vue)**：
    *   新增按鈕：`[Open Local Vault]`。
    *   顯示邏輯：當切換到 `local-fs` 模式時，樹狀結構不再讀取虛擬的 FileList，而是即時顯示 `FileSystemDirectoryHandle` 的內容。
2.  **編輯器 (MarkdownEditor.vue)**：
    *   攔截 `Ctrl+S`：檢測當前模式。如果是 `local-fs`，調用 `saveFile()` 寫入硬碟；如果是 `browser`，維持寫入 LocalStorage。

---

## 4. 階段性實作路線圖 (Roadmap)

### Phase 1: 基礎建設 (Infrastructure)
- [x] 建立 `docs/OBSIDIAN_INTEGRATION.md` (本文檔)。
- [x] 研究並引入 `browser-fs-access` 庫 (可選，或直接用原生 API)。
- [x] 建立 `types/fileSystem.ts` 定義檔案系統型別。

### Phase 2: 檔案系統串接 (Core Logic)
- [x] 實作 `composables/useFileSystem.ts`。
- [x] 實作 `stores/fileSystemStore.ts` 管理狀態。
- [x] 實作「開啟資料夾」並遞迴列出檔案結構的功能。
- [x] 實作「讀取」與「寫入」`.md` 檔案的功能。

### Phase 3: UI 整合 (UI Integration)
- [x] 修改側邊欄，增加「開啟 Obsidian 庫」的按鈕 (`SidebarContent.vue`)。
- [x] 實作本地檔案列表的視覺化渲染 (`LocalVaultTree.vue`, `LocalFileItem.vue`)。
- [x] 整合 Tab 系統：開啟本地檔案時，Tab 標題顯示檔名。
- [x] 實作 Ctrl+S 存檔功能：本地模式下直接寫入硬碟。

### Phase 4: AI 工作流優化 (Workflow Optimization)
- [x] 增加「建立新檔案」功能：在 Web 端新建檔案，直接在硬碟產生 `.md` 檔。
- [ ] 增加「Obsidian URI 跳轉」：在 Tab 標題右鍵選單增加 "Open in Obsidian App"，方便跳轉回桌面軟體。

### Phase 5: Git 同步整合 (Git Sync Integration)
- [ ] 整合 `isomorphic-git` 實現瀏覽器端 Git 操作
- [ ] 實作 Git 初始化與遠端設定功能
- [ ] 實作 Pull / Push / Sync 操作
- [ ] 實作自動同步功能
- [ ] 實作衝突偵測與解決介面

> 📄 詳細計畫請參考：[GIT_SYNC_PLAN.md](./GIT_SYNC_PLAN.md)

---

## 5. 替代方案：Obsidian URI (輕量級)

若不想大幅改動程式碼，可僅實作「跳轉」功能。

**功能**：在介面上增加一顆按鈕，點擊後呼叫 Obsidian 開啟當前同名檔案。
**限制**：這要求使用者必須手動把 Web 上的內容複製回 Obsidian，或先手動存檔。這無法達成「雙向編輯」，僅是單向跳轉。

**結論**：建議優先採用 **File System Access API** 方案，能最大化發揮本專案作為 AI 輔助編輯器的潛力。
