import hljs from 'highlight.js'
import { marked } from 'marked'
import { computed, type Ref } from 'vue'

/**
 * Markdown rendering composable
 * Integrates marked.js for parsing Markdown and highlight.js for syntax highlighting
 */
export function useMarkdown(content: Ref<string>) {
  // Configure marked.js (v11.x API)
  marked.use({
    breaks: true, // Support GitHub-style line breaks
    gfm: true, // Enable GitHub Flavored Markdown
  })

  // Custom code block renderer, integrating highlight.js
  const renderer = new marked.Renderer()

  renderer.code = (code: string, language: string | undefined) => {
    // If language is mermaid, return special mermaid container
    if (language === 'mermaid') {
      // Use data attribute to store original code, later rendered by useMermaid
      return `<div class="mermaid-container" data-mermaid-code="${escapeHtml(code)}"></div>`
    }

    // If language is specified, use highlight.js for syntax highlighting
    if (language && hljs.getLanguage(language)) {
      try {
        const highlighted = hljs.highlight(code, { language }).value
        return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`
      } catch (err) {
        // If highlighting fails, return unhighlighted code
        console.warn(`Failed to highlight code with language "${language}":`, err)
      }
    }
    // No language specified or language not supported, return unhighlighted code
    return `<pre><code class="hljs">${escapeHtml(code)}</code></pre>`
  }

  // Custom inline code renderer
  renderer.codespan = (code: string) => {
    return `<code class="inline-code">${escapeHtml(code)}</code>`
  }

  // Custom link renderer, ensure external links open in new tab
  renderer.link = (href: string | null, title: string | null, text: string) => {
    if (!href) return text

    const isExternal = href.startsWith('http://') || href.startsWith('https://')
    const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''

    return `<a href="${escapeHtml(href)}"${target}${titleAttr}>${text}</a>`
  }

  // Custom table renderer, enhanced table styling with wrapper for scrolling
  renderer.table = (header: string, body: string) => {
    return `<div class="table-container">\n<table class="markdown-table">\n<thead>\n${header}</thead>\n<tbody>\n${body}</tbody>\n</table>\n</div>`
  }

  // Custom blockquote renderer
  renderer.blockquote = (quote: string) => {
    return `<blockquote class="markdown-blockquote">${quote}</blockquote>`
  }

  // Set custom renderer
  marked.use({ renderer })

  // Calculate rendered HTML
  const html = computed(() => {
    if (!content.value.trim()) {
      return '<p class="empty-state">Preview content will be displayed here...</p>'
    }

    try {
      return marked.parse(content.value) as string
    } catch (error) {
      console.error('Markdown parsing error:', error)
      return `<div class="error-state">
        <p>⚠️ Markdown Parsing Error</p>
        <pre>${escapeHtml(String(error))}</pre>
      </div>`
    }
  })

  return {
    html
  }
}

/**
 * HTML escape function, prevents XSS attacks and attribute truncation
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
