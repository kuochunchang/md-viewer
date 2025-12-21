import { computed, type Ref } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'

/**
 * Markdown 渲染 composable
 * 整合 marked.js 解析 Markdown 並使用 highlight.js 進行程式碼語法高亮
 */
export function useMarkdown(content: Ref<string>) {
  // 配置 marked.js (v11.x API)
  marked.use({
    breaks: true, // 支援 GitHub 風格的換行
    gfm: true, // 啟用 GitHub Flavored Markdown
  })

  // 自定義程式碼區塊渲染器，整合 highlight.js
  const renderer = new marked.Renderer()

  renderer.code = (code: string, language: string | undefined) => {
    // 如果語言是 mermaid，返回特殊的 mermaid 容器
    if (language === 'mermaid') {
      // 使用 data 屬性儲存原始程式碼，稍後由 useMermaid 渲染
      return `<div class="mermaid-container" data-mermaid-code="${escapeHtml(code)}"></div>`
    }

    // 如果指定了語言，使用 highlight.js 進行語法高亮
    if (language && hljs.getLanguage(language)) {
      try {
        const highlighted = hljs.highlight(code, { language }).value
        return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`
      } catch (err) {
        // 如果高亮失敗，返回未高亮的程式碼
        console.warn(`Failed to highlight code with language "${language}":`, err)
      }
    }
    // 沒有指定語言或語言不支援，返回未高亮的程式碼
    return `<pre><code class="hljs">${escapeHtml(code)}</code></pre>`
  }

  // 自定義行內程式碼渲染器
  renderer.codespan = (code: string) => {
    return `<code class="inline-code">${escapeHtml(code)}</code>`
  }

  // 自定義連結渲染器，確保外部連結在新分頁開啟
  renderer.link = (href: string | null, title: string | null, text: string) => {
    if (!href) return text
    
    const isExternal = href.startsWith('http://') || href.startsWith('https://')
    const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
    
    return `<a href="${escapeHtml(href)}"${target}${titleAttr}>${text}</a>`
  }

  // 自定義表格渲染器，增強表格樣式
  renderer.table = (header: string, body: string) => {
    return `<table class="markdown-table">\n<thead>\n${header}</thead>\n<tbody>\n${body}</tbody>\n</table>`
  }

  // 自定義引用區塊渲染器
  renderer.blockquote = (quote: string) => {
    return `<blockquote class="markdown-blockquote">${quote}</blockquote>`
  }

  // 設定自定義 renderer
  marked.use({ renderer })

  // 計算渲染後的 HTML
  const html = computed(() => {
    if (!content.value.trim()) {
      return '<p class="empty-state">預覽內容將顯示在這裡...</p>'
    }

    try {
      return marked.parse(content.value) as string
    } catch (error) {
      console.error('Markdown parsing error:', error)
      return `<div class="error-state">
        <p>⚠️ Markdown 解析錯誤</p>
        <pre>${escapeHtml(String(error))}</pre>
      </div>`
    }
  })

  return {
    html
  }
}

/**
 * HTML 轉義函數，防止 XSS 攻擊
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
