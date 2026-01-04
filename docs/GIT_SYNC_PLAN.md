# Git 同步功能實作計畫 (Git Sync Integration Plan)

**日期**: 2026-01-04  
**專案**: md-viewer (Markdown & Mermaid Viewer)  
**目標**: 在 Web 端整合 Git 同步功能，讓使用者可以跨裝置同步 Obsidian Vault

---

## 1. 功能概述 (Feature Overview)

### 1.1 核心目標

讓使用者可以在 md-viewer 中直接操作 Git，實現跨裝置的筆記同步，無需手動執行 Git 命令。

### 1.2 主要功能

| 功能 | 描述 |
|------|------|
| **初始化 Git** | 為尚未使用 Git 的 Vault 初始化 Git 倉庫 |
| **連接遠端** | 設定 GitHub/GitLab 遠端倉庫 URL 和認證 |
| **手動同步** | Pull / Push / Sync All 按鈕 |
| **自動同步** | 定時自動 commit & push |
| **衝突處理** | 偵測並提示衝突，讓使用者選擇解決方式 |
| **狀態顯示** | 顯示未提交變更、上次同步時間等 |
| **批量操作** | 「Sync All Vaults」一次同步所有 Vault |
| **Clone 功能** | 在新電腦上直接從 remote clone Vault |

### 1.3 關鍵設計決策

| 決策 | 說明 |
|------|------|
| **一個 Vault = 一個 Git Repo** | 每個 Vault 是獨立的 Git 倉庫，符合 Obsidian 生態慣例，可獨立管理權限 |
| **共用認證** | GitHub Token 設定一次，可存取該帳號下所有 repo |
| **路徑無關** | 不同電腦上的 Vault 可以放在不同路徑，Git 只同步相對路徑的檔案 |
| **Token 本地儲存** | GitHub Token 只存 localStorage，絕不同步到雲端 |
| **預設手動同步** | 自動同步預設關閉，讓使用者完全掌控同步時機 |
| **Pull-First 策略** | Sync 操作順序：Pull → Commit → Push，確保先取得最新變更再推送 |
| **Obsidian Git 共存** | 偵測到 Obsidian Git 時，自動切換為「僅 Pull」模式，避免衝突 |

### 1.4 同步時機與策略

#### 手動同步（預設）

| 操作 | 動作 | 快捷鍵 |
|------|------|--------|
| **Sync** | Pull → Commit → Push | `Ctrl+Shift+S` |
| **Pull** | 僅拉取遠端變更 | - |
| **Push** | Commit → Push（不先 Pull） | - |
| **Sync All** | 對所有 Vault 執行 Sync | - |

#### 自動同步（可選開啟）

| 時機 | 動作 | 預設 |
|------|------|------|
| 啟動時 | 自動 Pull | ❌ 關閉 |
| 定時 | 每 N 分鐘 Sync | ❌ 關閉 |
| 儲存後 | 延遲 Commit | ❌ 關閉 |

#### Obsidian Git 共存模式

```
偵測到 Obsidian Git 插件
    ↓
自動進入「共存模式」：
├── ✅ 保留：Pull、狀態顯示
├── ⚠️ 警告：Commit/Push（避免衝突）
└── 💡 提示：「Git 同步由 Obsidian Git 管理」
```

---

## 2. 技術方案 (Technical Approach)

### 2.1 核心依賴

```bash
npm install isomorphic-git
```

[isomorphic-git](https://isomorphic-git.org/) 是純 JavaScript 實作的 Git，可在瀏覽器中運行。

### 2.2 檔案系統整合

使用 File System Access API + isomorphic-git 的 `fs` 接口：

```typescript
import * as git from 'isomorphic-git'
import http from 'isomorphic-git/http/web'

// 將 FileSystemDirectoryHandle 轉換為 isomorphic-git 可用的 fs
// 這需要使用 @aspect-build/aspect-fs 或自行實作 fs adapter
```

### 2.3 認證方式

使用 GitHub Personal Access Token (PAT)：
- 使用者需在 GitHub 建立 PAT (with `repo` scope)
- Token 存於 localStorage，**不同步到雲端**
- 每個 Vault 可以有不同的認證設定

---

## 3. 資料結構設計 (Data Structure)

### 3.1 Git 設定介面

```typescript
// types/git.ts

export interface GitCredentials {
  /** GitHub Personal Access Token */
  token: string
  /** Git 使用者名稱 (用於 commit author) */
  userName: string
  /** Git 使用者 email (用於 commit author) */
  userEmail: string
}

export interface GitRemoteConfig {
  /** 遠端名稱，預設 "origin" */
  name: string
  /** 遠端 URL，例如 https://github.com/user/vault.git */
  url: string
}

export interface GitSyncSettings {
  /** 是否啟用自動同步（預設: false） */
  autoSyncEnabled: boolean
  /** 自動 sync 間隔（分鐘），預設 5 */
  autoSyncInterval: number
  /** 啟動時自動 pull（預設: false） */
  autoPullOnStartup: boolean
  /** Commit message 風格 */
  commitMessageStyle: 'ai' | 'smart' | 'timestamp' | 'custom'
  /** 自訂 commit 訊息模板（當 style 為 'custom' 時使用） */
  commitMessageTemplate: string  // 預設: "vault backup: {{date}}"
  /** 
   * 與 Obsidian Git 的協作模式
   * - 'auto': 自動偵測，如有 Obsidian Git 則進入共存模式
   * - 'full': 完整 Git 功能（忽略 Obsidian Git）
   * - 'pull-only': 僅 Pull（讓 Obsidian Git 負責 Commit/Push）
   */
  obsidianGitMode: 'auto' | 'full' | 'pull-only'
}

// 預設值
const DEFAULT_SYNC_SETTINGS: GitSyncSettings = {
  autoSyncEnabled: false,        // ❌ 預設關閉
  autoSyncInterval: 5,           // 5 分鐘（如果開啟的話）
  autoPullOnStartup: false,      // ❌ 預設關閉
  commitMessageStyle: 'smart',   // 智慧摘要
  commitMessageTemplate: 'vault backup: {{date}}',
  obsidianGitMode: 'auto',       // 自動偵測
}

/**
 * Commit Message 風格說明：
 * 
 * - 'ai': 使用 Gemini AI 分析變更內容，生成語義化的 commit message
 *         例如: "docs: update meeting notes with action items"
 *         需要設定 Gemini API Key，若失敗會 fallback 到 'smart'
 * 
 * - 'smart': 根據變更檔案自動生成摘要
 *         單一檔案: "Update daily-note.md"
 *         少量檔案: "Update meeting.md, tasks.md"
 *         多檔案: "vault backup: 2026-01-04 07:41 (15 files)"
 * 
 * - 'timestamp': 簡單時間戳記
 *         "vault backup: 2026-01-04 07:41"
 * 
 * - 'custom': 使用者自訂模板，支援變數：
 *         {{date}} - 日期時間
 *         {{count}} - 變更檔案數
 *         {{files}} - 檔案列表
 *         {{vault}} - Vault 名稱
 */

export interface VaultGitStatus {
  /** 是否已初始化 Git */
  isGitRepo: boolean
  /** 是否有設定遠端 */
  hasRemote: boolean
  /** 當前分支 */
  currentBranch: string | null
  /** 有變更的檔案數量 */
  changedFilesCount: number
  /** 是否有未推送的 commits */
  hasUnpushedCommits: boolean
  /** 上次同步時間 */
  lastSyncTime: number | null
  /** 同步狀態 */
  syncStatus: 'idle' | 'syncing' | 'error' | 'conflict'
  /** 錯誤訊息 */
  errorMessage: string | null
}

export interface VaultGitConfig {
  /** Vault ID */
  vaultId: string
  /** Vault 名稱 */
  vaultName: string
  /** 遠端設定 */
  remote: GitRemoteConfig | null
  /** 同步設定 */
  syncSettings: GitSyncSettings
  /** 當前狀態 */
  status: VaultGitStatus
}
```

### 3.2 localStorage 儲存結構

```typescript
// localStorage keys
const STORAGE_KEYS = {
  // 全域 Git 認證（所有 Vault 共用）
  GIT_CREDENTIALS: 'md-viewer-git-credentials',
  // 各 Vault 的 Git 設定
  VAULT_GIT_CONFIGS: 'md-viewer-vault-git-configs',
}

// 儲存格式
interface StoredGitData {
  credentials: GitCredentials | null
  vaultConfigs: Record<string, VaultGitConfig>  // vaultId -> config
}
```

---

## 4. 模組設計 (Module Design)

### 4.1 新增檔案結構

```
src/
├── composables/
│   └── useGitSync.ts          # Git 同步核心邏輯
├── stores/
│   └── gitStore.ts            # Git 狀態管理
├── components/
│   ├── GitSyncPanel.vue       # Git 同步面板 UI
│   ├── GitSetupDialog.vue     # Git 初始化/設定對話框
│   └── GitConflictDialog.vue  # 衝突解決對話框
├── lib/
│   └── fsAdapter.ts           # File System Access API -> isomorphic-git fs 轉接器
└── types/
    └── git.ts                 # Git 相關型別定義
```

### 4.2 fsAdapter 設計

由於 isomorphic-git 需要 Node.js 風格的 `fs` 接口，我們需要一個轉接器將 File System Access API 轉換為相容格式：

```typescript
// lib/fsAdapter.ts

export class FileSystemAdapter {
  private rootHandle: FileSystemDirectoryHandle

  constructor(handle: FileSystemDirectoryHandle) {
    this.rootHandle = handle
  }

  // 實作 isomorphic-git 需要的 fs 方法
  async readFile(filepath: string, options?: { encoding?: string }): Promise<Uint8Array | string>
  async writeFile(filepath: string, data: Uint8Array | string): Promise<void>
  async unlink(filepath: string): Promise<void>
  async readdir(filepath: string): Promise<string[]>
  async mkdir(filepath: string, options?: { recursive?: boolean }): Promise<void>
  async rmdir(filepath: string, options?: { recursive?: boolean }): Promise<void>
  async stat(filepath: string): Promise<{ type: 'file' | 'dir', mode: number, size: number, ... }>
  async lstat(filepath: string): Promise<...>
  async readlink(filepath: string): Promise<string>
  async symlink(target: string, filepath: string): Promise<void>
  async chmod(filepath: string, mode: number): Promise<void>
}
```

### 4.3 useGitSync Composable

```typescript
// composables/useGitSync.ts

export function useGitSync() {
  // ===== 初始化相關 =====
  
  /** 檢查 Vault 是否已初始化 Git */
  async function isGitInitialized(vaultHandle: FileSystemDirectoryHandle): Promise<boolean>
  
  /** 初始化 Git 倉庫 */
  async function initializeGit(vaultHandle: FileSystemDirectoryHandle): Promise<void>
  
  /** 設定遠端 */
  async function setRemote(vaultHandle: FileSystemDirectoryHandle, url: string): Promise<void>
  
  // ===== 同步操作 =====
  
  /** Pull 最新變更 */
  async function pull(vaultHandle: FileSystemDirectoryHandle): Promise<PullResult>
  
  /** Commit 本地變更 */
  async function commit(vaultHandle: FileSystemDirectoryHandle, message: string): Promise<string>
  
  /** Push 到遠端 */
  async function push(vaultHandle: FileSystemDirectoryHandle): Promise<void>
  
  /** 完整同步流程: Pull -> Commit -> Push */
  async function syncAll(vaultHandle: FileSystemDirectoryHandle): Promise<SyncResult>
  
  // ===== 狀態查詢 =====
  
  /** 取得 Git 狀態 */
  async function getStatus(vaultHandle: FileSystemDirectoryHandle): Promise<VaultGitStatus>
  
  /** 取得變更的檔案列表 */
  async function getChangedFiles(vaultHandle: FileSystemDirectoryHandle): Promise<FileChange[]>
  
  // ===== 衝突處理 =====
  
  /** 檢查是否有衝突 */
  async function hasConflicts(vaultHandle: FileSystemDirectoryHandle): Promise<boolean>
  
  /** 取得衝突檔案列表 */
  async function getConflictFiles(vaultHandle: FileSystemDirectoryHandle): Promise<string[]>
  
  /** 解決衝突（選擇本地或遠端版本） */
  async function resolveConflict(
    vaultHandle: FileSystemDirectoryHandle,
    filepath: string,
    resolution: 'ours' | 'theirs'
  ): Promise<void>
  
  // ===== Commit Message 生成 =====
  
  /** 
   * 根據設定生成 commit message
   * - 'ai': 使用 Gemini AI 分析 diff 內容
   * - 'smart': 根據變更檔案數量和類型生成
   * - 'timestamp': 簡單時間戳記
   * - 'custom': 使用者自訂模板
   */
  async function generateCommitMessage(
    changes: FileChange[],
    style: 'ai' | 'smart' | 'timestamp' | 'custom',
    template?: string
  ): Promise<string>
  
  // ===== 自動同步 =====
  
  /** 啟動自動同步 */
  function startAutoSync(vaultId: string): void
  
  /** 停止自動同步 */
  function stopAutoSync(vaultId: string): void
  
  return {
    isGitInitialized,
    initializeGit,
    setRemote,
    pull,
    commit,
    push,
    syncAll,
    getStatus,
    getChangedFiles,
    hasConflicts,
    getConflictFiles,
    resolveConflict,
    generateCommitMessage,
    startAutoSync,
    stopAutoSync,
  }
}
```

### 4.4 AI Commit Message 實作細節

整合現有的 `useGeminiAI` composable：

```typescript
// 在 useGeminiAI.ts 中新增

/**
 * Generate a commit message based on file changes using AI
 */
async function generateCommitMessage(changes: FileChange[]): Promise<string> {
    const client = getClient()
    if (!client) {
        throw new Error('API key not configured')
    }

    // 建立變更摘要
    const changesSummary = changes.map(c => {
        const status = c.status === 'added' ? '+' : 
                       c.status === 'deleted' ? '-' : 'M'
        return `${status} ${c.path}`
    }).join('\n')

    const prompt = `Generate a concise git commit message for these changes.
Rules:
1. Use conventional commit format (feat:, fix:, docs:, refactor:, chore:)
2. Keep the subject line under 50 characters
3. Be specific but concise
4. Use present tense ("add" not "added")
5. Output ONLY the commit message, no explanation

Changed files:
${changesSummary}

${changes.length <= 3 && changes.some(c => c.diff) ? `
Brief diff summary:
${changes.slice(0, 3).map(c => `
--- ${c.path} ---
${c.diff?.slice(0, 300) || '(no diff)'}
`).join('\n')}
` : ''}

Commit message:`

    const response = await client.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
    })

    const message = response.text?.trim()
    
    // 驗證並清理結果
    if (!message) {
        throw new Error('No response from AI')
    }
    
    // 移除可能的引號
    return message.replace(/^["']|["']$/g, '')
}
```

### 4.5 Commit Message 生成策略

```typescript
// 在 useGitSync.ts 中

async function generateCommitMessage(
    changes: FileChange[],
    style: CommitMessageStyle,
    template?: string
): Promise<string> {
    const date = new Date().toISOString().slice(0, 16).replace('T', ' ')
    
    switch (style) {
        case 'ai':
            // 嘗試使用 AI，失敗則 fallback
            if (geminiAI.isApiKeySet.value) {
                try {
                    return await geminiAI.generateCommitMessage(changes)
                } catch (e) {
                    console.warn('AI commit message failed, falling back to smart:', e)
                }
            }
            // fallthrough to smart
            
        case 'smart':
            return generateSmartMessage(changes, date)
            
        case 'timestamp':
            return `vault backup: ${date}`
            
        case 'custom':
            return renderTemplate(template || 'vault backup: {{date}}', {
                date,
                count: changes.length,
                files: changes.map(c => c.name).join(', '),
                vault: currentVault.value?.name || 'vault'
            })
            
        default:
            return `vault backup: ${date}`
    }
}

function generateSmartMessage(changes: FileChange[], date: string): string {
    if (changes.length === 0) {
        return `sync: ${date}`
    }
    
    if (changes.length === 1) {
        const file = changes[0]
        const action = file.status === 'added' ? 'Add' : 
                       file.status === 'deleted' ? 'Delete' : 'Update'
        return `${action} ${file.name}`
    }
    
    if (changes.length <= 3) {
        const names = changes.map(f => f.name).join(', ')
        return `Update ${names}`
    }
    
    return `vault backup: ${date} (${changes.length} files)`
}

---

## 5. UI 設計 (UI Design)

### 5.1 Git Sync 面板

位於側邊欄 Vault 區塊內，或作為獨立面板：

```
┌─────────────────────────────────────────────────────┐
│  🔀 Git Sync                                    ⚙️  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📊 Status                                          │
│  ┌─────────────────────────────────────────────┐   │
│  │  Branch: main                               │   │
│  │  ● 3 files changed                          │   │
│  │  ○ No unpushed commits                      │   │
│  │  Last sync: 5 minutes ago                   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  🔄 Actions                                         │
│  ┌───────────┐ ┌───────────┐ ┌───────────────┐    │
│  │  ↓ Pull   │ │  ↑ Push   │ │  🔄 Sync All  │    │
│  └───────────┘ └───────────┘ └───────────────────┘ │
│                                                     │
│  ⚡ Auto Sync: ON                            [OFF] │
│     Interval: 5 minutes                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5.2 Git 設定對話框

首次設定或點擊 ⚙️ 時顯示：

```
┌───────────────────────────────────────────────────────────┐
│  🔧 Git Sync Setup                                    ✕  │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  📦 Repository Status                                     │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  ✅ Git initialized                                 │ │
│  │  ✅ Remote configured: github.com/user/vault        │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  🔑 Authentication                                        │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  GitHub Personal Access Token                       │ │
│  │  ┌─────────────────────────────────────────────┐   │ │
│  │  │ ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx    │   │ │
│  │  └─────────────────────────────────────────────┘   │ │
│  │  ⓘ Token stored locally only, never synced        │ │
│  │                                                     │ │
│  │  Author Name                                        │ │
│  │  ┌─────────────────────────────────────────────┐   │ │
│  │  │ Your Name                                   │   │ │
│  │  └─────────────────────────────────────────────┘   │ │
│  │                                                     │ │
│  │  Author Email                                       │ │
│  │  ┌─────────────────────────────────────────────┐   │ │
│  │  │ your.email@example.com                      │   │ │
│  │  └─────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  🌐 Remote Repository                                     │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  URL                                                │ │
│  │  ┌─────────────────────────────────────────────┐   │ │
│  │  │ https://github.com/user/my-vault.git        │   │ │
│  │  └─────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ⚡ Auto Sync Settings                                    │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  [✓] Enable auto sync                               │ │
│  │  [✓] Auto commit every [ 5 ] minutes                │ │
│  │  [✓] Auto push after commit                         │ │
│  │  [✓] Auto pull on startup                           │ │
│  │                                                     │ │
│  │  Commit message template:                           │ │
│  │  ┌─────────────────────────────────────────────┐   │ │
│  │  │ vault backup: {{date}}                      │   │ │
│  │  └─────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│                              [ Cancel ]  [ Save Settings ]│
└───────────────────────────────────────────────────────────┘
```

### 5.3 未初始化 Git 的提示

```
┌─────────────────────────────────────────────────────┐
│  🔀 Git Sync                                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ⚠️ Git not initialized                             │
│                                                     │
│  This vault is not a Git repository.               │
│  Initialize Git to enable sync across devices.     │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │        🚀 Initialize Git Repository         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Or connect to an existing repository:             │
│  ┌─────────────────────────────────────────────┐   │
│  │        📥 Clone from Remote                 │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5.4 多 Vault 總覽面板（批量操作）

側邊欄底部或獨立面板，顯示所有 Vault 的 Git 狀態：

```
┌─────────────────────────────────────────────────────────┐
│  🔀 Git Sync Overview                               ⚙️  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📂 Vaults                                              │
│  ┌───────────────────────────────────────────────────┐ │
│  │                                                   │ │
│  │  📁 MyNotes                                       │ │
│  │     ● 2 files changed  ·  Last sync: 5 min ago   │ │
│  │     ┌────────┐                                   │ │
│  │     │  Sync  │                                   │ │
│  │     └────────┘                                   │ │
│  │                                                   │ │
│  │  📁 WorkVault                                     │ │
│  │     ✓ Up to date  ·  Last sync: 1 hour ago       │ │
│  │     ┌────────┐                                   │ │
│  │     │  Sync  │                                   │ │
│  │     └────────┘                                   │ │
│  │                                                   │ │
│  │  📁 PersonalJournal                               │ │
│  │     ⚠️ Not connected to Git                       │ │
│  │     ┌────────┐                                   │ │
│  │     │ Setup  │                                   │ │
│  │     └────────┘                                   │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │              🔄 Sync All Vaults                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │              📥 Clone from Remote                 │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.5 Clone from Remote 對話框

在新電腦上設定時使用，直接從 GitHub clone 一個已存在的 Vault：

```
┌───────────────────────────────────────────────────────────┐
│  📥 Clone from Remote                                 ✕  │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  Clone an existing vault from GitHub to your computer.   │
│                                                           │
│  🔑 Authentication (required first)                       │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  ✅ GitHub connected as: guojun                     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  🌐 Repository URL                                        │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  https://github.com/guojun/my-vault.git             │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  📁 Clone to                                              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  [Select folder...]                                 │ │
│  │                                                     │ │
│  │  Selected: /Users/john/Documents/Obsidian           │ │
│  │  Vault will be created at: .../Obsidian/my-vault    │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ⓘ The vault name will be extracted from the repo URL.  │
│     You can rename the folder after cloning.             │
│                                                           │
│                                [ Cancel ]  [ Clone ]     │
└───────────────────────────────────────────────────────────┘
```

### 5.6 同步進度指示

執行同步時的進度顯示：

```
┌─────────────────────────────────────────────────────┐
│  🔄 Syncing MyNotes...                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ████████████░░░░░░░░  60%                          │
│                                                     │
│  ↓ Pulling changes...                               │
│    Received 3 objects                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 6. 實作路線圖 (Implementation Roadmap)

### Phase 1: 基礎建設 ✅ 完成

- [x] 安裝 `isomorphic-git` 依賴
- [x] 實作 `lib/fsAdapter.ts` - File System Access API 轉接器
- [x] 建立 `types/git.ts` 型別定義
- [x] 建立 `stores/gitStore.ts` 狀態管理

### Phase 2: 核心功能 ✅ 完成

- [x] 實作 `composables/useGitSync.ts`:
  - [x] `isGitInitialized()` - 檢查是否為 Git 倉庫
  - [x] `initializeGit()` - 初始化 Git
  - [x] `setRemote()` - 設定遠端 URL
  - [x] `getStatus()` - 取得 Git 狀態
  - [x] `getChangedFiles()` - 取得變更檔案列表
  - [x] `commit()` - 提交變更
  - [x] `pull()` - 拉取遠端變更
  - [x] `push()` - 推送到遠端
  - [x] `syncAll()` - 完整同步流程
  - [x] `cloneRepo()` - 克隆遠端倉庫
  - [x] `generateCommitMessage()` - 生成 commit 訊息

### Phase 3: UI 整合 ✅ 完成

- [x] 實作 `GitSetupDialog.vue` - Git 設定對話框
- [x] 實作 `GitSyncPanel.vue` - 同步面板
- [x] 整合到側邊欄 (每個 Vault 顯示 Git 狀態)
- [ ] 加入快捷鍵支援 (例如 Ctrl+Shift+S = Sync All)

### Phase 4: 自動同步 (約 1-2 天)

- [ ] 實作背景定時 commit & push
- [ ] 實作啟動時自動 pull
- [ ] 加入同步進度指示器

### Phase 5: 衝突處理 (約 2-3 天)

- [ ] 實作 `GitConflictDialog.vue` - 衝突解決對話框
- [ ] 偵測並顯示衝突檔案
- [ ] 提供「選擇本地/遠端版本」選項
- [ ] (進階) 提供手動合併介面

### Phase 6: 優化與測試 (約 1-2 天)

- [ ] 錯誤處理與使用者友善的錯誤訊息
- [ ] 加入操作確認（例如 force push 警告）
- [ ] 效能優化（大型 Vault 的處理）
- [ ] 撰寫使用文件

### Bonus: 智能 Repo 建立 ✅ 已實作

- [x] 自動偵測 Remote URL 的 Repository 是否存在
- [x] 如不存在，提供「Create Private」/「Create Public」按鈕
- [x] 使用 GitHub API 自動建立 Repository
- [x] 建立後自動設定 Remote 並執行首次 Push
- [x] 根據 Vault 名稱建議 Repository 名稱
- [x] 取得 GitHub 使用者名稱以產生建議 URL

---

## 7. 安全性考量 (Security Considerations)

### 7.1 Token 儲存

| 項目 | 處理方式 |
|------|----------|
| **儲存位置** | 僅存於 localStorage，不同步到 Google Drive |
| **顯示方式** | 輸入後以 `•••` 遮蔽，僅首次顯示 |
| **清除機制** | 提供「登出」按鈕可清除 token |

### 7.2 .gitignore 建議

在初始化時自動加入或提示使用者更新：

```gitignore
# Obsidian
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/plugins/*/data.json

# Sensitive files (if any)
*.secret
```

### 7.3 CORS 處理

GitHub API 需要處理 CORS，有兩種方式：

1. **使用 CORS Proxy** (開發/測試用)
   ```typescript
   const corsProxy = 'https://cors.isomorphic-git.org'
   ```

2. **直接 API 呼叫** (生產環境)
   使用者使用 PAT 可以直接透過 HTTPS 操作，通常不需要 proxy

---

## 8. 已知限制 (Known Limitations)

| 限制 | 說明 | 可能的解決方案 |
|------|------|----------------|
| **瀏覽器支援** | 僅支援 Chromium 核心 (Chrome, Edge, Opera) | 提示使用者使用支援的瀏覽器 |
| **大型倉庫** | isomorphic-git 處理大型倉庫較慢 | 建議 Vault 控制在合理大小 |
| **SSH 認證** | 瀏覽器無法使用 SSH key | 僅支援 HTTPS + Token |
| **Git LFS** | isomorphic-git 不支援 LFS | 提示使用者避免使用 LFS |
| **複雜合併** | 僅支援 fast-forward 或簡單 merge | 複雜衝突建議使用桌面 Git 工具 |

---

## 9. 備選方案 (Fallback Options)

如果 isomorphic-git + File System Access API 的整合過於複雜，我們可以考慮：

### 9.1 簡化版：僅顯示狀態 + 外部連結

- 檢測 `.git` 資料夾是否存在
- 顯示「此 Vault 使用 Git 管理」
- 提供「在終端機開啟」的 URI (僅 macOS/Linux)
- 提供 GitHub Desktop 連結

### 9.2 使用 Obsidian Git Plugin 為主

- 建議使用者安裝 Obsidian Git 插件
- md-viewer 只負責偵測檔案變化並重新載入

---

## 10. 參考資源 (References)

- [isomorphic-git Documentation](https://isomorphic-git.org/docs/en/guide)
- [isomorphic-git Examples](https://isomorphic-git.org/docs/en/snippets)
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)

---

## 11. 下一步 (Next Steps)

1. **確認計畫**：請確認此計畫是否符合您的需求
2. **開始實作**：從 Phase 1 開始，逐步完成各階段
3. **持續迭代**：根據實際使用回饋調整功能

---

*本文件為 md-viewer Git 同步功能的實作計畫，將隨開發進度持續更新。*
