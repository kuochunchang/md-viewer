export const DEFAULT_CONTENT = `# Markdown & Mermaid 範例

這是一個完整的 Markdown 與 Mermaid 圖表範例文件。

## 📝 Markdown 語法示範

### 標題層級
這是一個三級標題，Markdown 支援六個層級的標題。

### 文字格式
- **粗體文字**
- *斜體文字*
- ~~刪除線~~
- \`行內程式碼\`

### 列表

#### 無序列表
- 項目 1
- 項目 2
  - 子項目 2.1
  - 子項目 2.2
- 項目 3

#### 有序列表
1. 第一項
2. 第二項
3. 第三項

### 連結與圖片
[連結文字](https://example.com)

### 程式碼區塊

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet('World');
\`\`\`

\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))
\`\`\`

### 引用
> 這是一個引用區塊。
> 可以包含多行文字。

---

## 📊 Mermaid 圖表示範

### Flowchart（流程圖）

\`\`\`mermaid
graph TD
    A[開始] --> B{判斷條件}
    B -->|是| C[執行操作 A]
    B -->|否| D[執行操作 B]
    C --> E[結束]
    D --> E
\`\`\`

### Sequence Diagram（時序圖）

\`\`\`mermaid
sequenceDiagram
    participant 用戶
    participant 前端
    participant 後端
    participant 資料庫

    用戶->>前端: 發送請求
    前端->>後端: API 呼叫
    後端->>資料庫: 查詢資料
    資料庫-->>後端: 返回結果
    後端-->>前端: JSON 回應
    前端-->>用戶: 顯示資料
\`\`\`

### Gantt Chart（甘特圖）

\`\`\`mermaid
gantt
    title 專案時程
    dateFormat  YYYY-MM-DD
    section 階段一
    需求分析           :a1, 2024-01-01, 7d
    系統設計           :a2, after a1, 5d
    section 階段二
    開發實作           :b1, after a2, 14d
    測試驗證           :b2, after b1, 7d
\`\`\`

---

## 🎉 開始使用

1. 編輯左側的 Markdown 內容
2. 右側會即時顯示渲染結果
3. 使用多頁籤管理多個文件
4. 內容會自動儲存至瀏覽器

享受寫作的樂趣！ ✨
`
