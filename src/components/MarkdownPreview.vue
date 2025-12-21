<template>
  <div
    class="markdown-preview"
    :style="{ fontSize: fontSize + 'px' }"
  >
    <div
      ref="previewContentRef"
      class="preview-content"
      v-html="renderedHtml"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useMarkdown } from '../composables/useMarkdown'
import { useMermaid } from '../composables/useMermaid'
import { debounce } from '../utils/debounce'

interface Props {
  content: string
  fontSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  fontSize: 14
})

// 使用 ref 包裝 content 以便傳入 composable
const contentRef = ref(props.content)

// 使用 useMarkdown composable 取得渲染後的 HTML
const { html: markdownHtml } = useMarkdown(contentRef)

// 使用 useMermaid composable 處理 Mermaid 圖表渲染
const { renderAllMermaid } = useMermaid()

// 預覽內容容器的引用
const previewContentRef = ref<HTMLElement | null>(null)

// 防抖處理：延遲 300ms 更新內容，優化大量輸入時的效能
const debouncedUpdate = debounce((newContent: string) => {
  contentRef.value = newContent
}, 300)

// 標記是否為首次載入
let isInitialLoad = true

// 立即更新內容（用於初始渲染）
const renderedHtml = computed(() => markdownHtml.value)

// 渲染 Mermaid 圖表的函數
const renderMermaidCharts = async () => {
  await nextTick()
  if (previewContentRef.value) {
    await renderAllMermaid(previewContentRef.value)
  }
}

// 監聽 props.content 變化，使用防抖更新
watch(() => props.content, (newContent) => {
  if (isInitialLoad) {
    // 首次載入時立即更新
    contentRef.value = newContent
    isInitialLoad = false
  } else {
    // 後續更新使用防抖
    debouncedUpdate(newContent)
  }
}, { immediate: true })

// 監聽渲染後的 HTML 變化，觸發 Mermaid 渲染
watch(renderedHtml, async () => {
  await renderMermaidCharts()
}, { immediate: true })

// 組件掛載後渲染 Mermaid
onMounted(async () => {
  await renderMermaidCharts()
})
</script>

<style scoped lang="scss">
@import '../styles/preview.scss';

.markdown-preview {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
  background-color: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));

  // RWD: 手機版面調整
  @media (max-width: 600px) {
    padding: 12px;
  }

  .preview-content {
    max-width: 100%;
    line-height: 1.8;
    word-wrap: break-word;
    overflow-wrap: break-word;

    // 標題樣式
    :deep(h1),
    :deep(h2),
    :deep(h3),
    :deep(h4),
    :deep(h5),
    :deep(h6) {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.25;
      color: rgb(var(--v-theme-on-surface));
    }

    :deep(h1) {
      font-size: 2em;
      border-bottom: 2px solid rgba(var(--v-theme-on-surface), 0.12);
      padding-bottom: 0.3em;
    }

    :deep(h2) {
      font-size: 1.75em;
      border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
      padding-bottom: 0.3em;
    }

    :deep(h3) {
      font-size: 1.5em;
    }

    :deep(h4) {
      font-size: 1.25em;
    }

    :deep(h5) {
      font-size: 1.1em;
    }

    :deep(h6) {
      font-size: 1em;
      color: rgba(var(--v-theme-on-surface), 0.7);
    }

    // 段落樣式
    :deep(p) {
      margin-bottom: 1em;
      line-height: 1.8;
    }

    // 列表樣式
    :deep(ul),
    :deep(ol) {
      margin-bottom: 1em;
      padding-left: 2em;
    }

    :deep(li) {
      margin-bottom: 0.5em;
      line-height: 1.6;
    }

    :deep(ul) {
      list-style-type: disc;
    }

    :deep(ol) {
      list-style-type: decimal;
    }

    :deep(ul ul),
    :deep(ol ol),
    :deep(ul ol),
    :deep(ol ul) {
      margin-top: 0.5em;
      margin-bottom: 0.5em;
    }

    // 連結樣式
    :deep(a) {
      color: rgb(var(--v-theme-primary));
      text-decoration: none;
      border-bottom: 1px solid transparent;
      transition: border-color 0.2s;

      &:hover {
        border-bottom-color: rgb(var(--v-theme-primary));
      }
    }

    // 程式碼區塊樣式
    :deep(pre) {
      background-color: rgba(var(--v-theme-on-surface), 0.05);
      border-radius: 6px;
      padding: 16px;
      margin: 1em 0;
      overflow-x: auto;
      border: 1px solid rgba(var(--v-theme-on-surface), 0.1);

      code {
        background: transparent;
        padding: 0;
        font-size: 0.9em;
        font-family: 'Courier New', 'Monaco', 'Menlo', monospace;
      }
    }

    // 行內程式碼樣式
    :deep(code:not(pre code)) {
      background-color: rgba(var(--v-theme-on-surface), 0.1);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', 'Monaco', 'Menlo', monospace;
      font-size: 0.9em;
    }

    :deep(.inline-code) {
      background-color: rgba(var(--v-theme-on-surface), 0.1);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', 'Monaco', 'Menlo', monospace;
      font-size: 0.9em;
    }

    // highlight.js 程式碼高亮樣式
    :deep(.hljs) {
      display: block;
      overflow-x: auto;
      padding: 0.5em;
      background: transparent;
    }

    // 引用樣式
    :deep(blockquote) {
      border-left: 4px solid rgb(var(--v-theme-primary));
      padding-left: 1em;
      margin: 1em 0;
      color: rgba(var(--v-theme-on-surface), 0.7);
      font-style: italic;
      background-color: rgba(var(--v-theme-on-surface), 0.03);
      padding: 1em;
      border-radius: 4px;
    }

    // 分隔線樣式
    :deep(hr) {
      border: none;
      border-top: 2px solid rgba(var(--v-theme-on-surface), 0.1);
      margin: 2em 0;
    }

    // 表格樣式
    :deep(table) {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
      overflow-x: auto;
      display: block;

      thead,
      tbody {
        display: table;
        width: 100%;
      }

      th,
      td {
        border: 1px solid rgba(var(--v-theme-on-surface), 0.2);
        padding: 0.75em;
        text-align: left;
      }

      th {
        background-color: rgba(var(--v-theme-on-surface), 0.05);
        font-weight: 600;
      }

      tr:nth-child(even) {
        background-color: rgba(var(--v-theme-on-surface), 0.02);
      }
    }

    // 圖片樣式
    :deep(img) {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 1em 0;
    }

    // 強調樣式
    :deep(strong) {
      font-weight: 600;
    }

    :deep(em) {
      font-style: italic;
    }

    // 刪除線樣式
    :deep(del) {
      text-decoration: line-through;
      opacity: 0.7;
    }

    // 空狀態樣式
    :deep(.empty-state) {
      color: rgba(var(--v-theme-on-surface), 0.5);
      text-align: center;
      padding: 3em 1em;
      font-style: italic;
    }

    // 錯誤狀態樣式
    :deep(.error-state) {
      padding: 1em;
      background-color: rgba(244, 67, 54, 0.1);
      border-left: 4px solid #f44336;
      border-radius: 4px;
      color: #f44336;
      margin: 1em 0;

      pre {
        background-color: rgba(0, 0, 0, 0.1);
        padding: 0.5em;
        border-radius: 4px;
        margin-top: 0.5em;
        font-size: 0.9em;
      }
    }

    // Mermaid 圖表容器樣式
    :deep(.mermaid-container) {
      margin: 1.5em 0;
      text-align: center;
      overflow-x: auto;
      padding: 1em;
      background-color: rgba(var(--v-theme-on-surface), 0.02);
      border-radius: 8px;
      border: 1px solid rgba(var(--v-theme-on-surface), 0.1);

      svg {
        max-width: 100%;
        height: auto;
      }

      .mermaid-error {
        padding: 1em;
        background-color: rgba(244, 67, 54, 0.1);
        border-left: 4px solid #f44336;
        border-radius: 4px;
        color: #f44336;
        text-align: left;

        p {
          margin: 0 0 0.5em 0;
        }

        pre {
          background-color: rgba(0, 0, 0, 0.1);
          padding: 0.75em;
          border-radius: 4px;
          margin-top: 0.5em;
          font-size: 0.85em;
          overflow-x: auto;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        details {
          margin-top: 0.5em;

          summary {
            cursor: pointer;
            color: rgba(244, 67, 54, 0.8);
            font-size: 0.9em;
            user-select: none;

            &:hover {
              color: #f44336;
            }
          }

          pre {
            margin-top: 0.5em;
            padding: 0.75em;
            background: rgba(0, 0, 0, 0.1);
            border-radius: 4px;
            font-size: 0.85em;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
        }
      }
    }
  }

  // 深色主題下的 Mermaid 容器
  .v-theme--dark & {
    :deep(.mermaid-container) {
      background-color: rgba(255, 255, 255, 0.03);
      border-color: rgba(255, 255, 255, 0.1);

      .mermaid-error {
        pre {
          background-color: rgba(0, 0, 0, 0.2);
        }

        details {
          pre {
            background: rgba(0, 0, 0, 0.2);
          }
        }
      }
    }
  }

  // 深色主題變體
  .v-theme--dark & {
    :deep(pre) {
      background-color: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.1);
    }

    :deep(code:not(pre code)),
    :deep(.inline-code) {
      background-color: rgba(255, 255, 255, 0.15);
    }

    :deep(blockquote) {
      background-color: rgba(255, 255, 255, 0.03);
      color: rgba(255, 255, 255, 0.7);
    }

    :deep(table) {
      th {
        background-color: rgba(255, 255, 255, 0.05);
      }

      tr:nth-child(even) {
        background-color: rgba(255, 255, 255, 0.02);
      }
    }
  }

  // 自訂滾動條樣式
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: rgba(var(--v-theme-on-surface), 0.2);
    border-radius: 4px;

    &:hover {
      background-color: rgba(var(--v-theme-on-surface), 0.3);
    }
  }
}
</style>
