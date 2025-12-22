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

// Wrap content with ref for composable
const contentRef = ref(props.content)

// Use useMarkdown composable to get rendered HTML
const { html: markdownHtml } = useMarkdown(contentRef)

// Use useMermaid composable to handle Mermaid chart rendering
const { renderAllMermaid } = useMermaid()

// Reference to preview content container
const previewContentRef = ref<HTMLElement | null>(null)

// Debounce: delay 300ms to update content, optimizing performance for fast typing
const debouncedUpdate = debounce((newContent: string) => {
  contentRef.value = newContent
}, 300)

// Flag for initial load
let isInitialLoad = true

// Immediately update content (for initial render)
const renderedHtml = computed(() => markdownHtml.value)

// Function to render Mermaid charts
const renderMermaidCharts = async () => {
  await nextTick()
  if (previewContentRef.value) {
    await renderAllMermaid(previewContentRef.value)
  }
}

// Watch props.content changes with debounce
watch(() => props.content, (newContent) => {
  if (isInitialLoad) {
    // Immediate update on first load
    contentRef.value = newContent
    isInitialLoad = false
  } else {
    // Use debounce for subsequent updates
    debouncedUpdate(newContent)
  }
}, { immediate: true })

// Watch for rendered HTML changes to trigger Mermaid rendering
watch(renderedHtml, async () => {
  await renderMermaidCharts()
}, { immediate: true })

// Render Mermaid after component mount
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

  // RWD: Mobile layout adjustment
  @media (max-width: 600px) {
    padding: 12px;
  }

  .preview-content {
    max-width: 100%;
    line-height: 1.8;
    word-wrap: break-word;
    overflow-wrap: break-word;

    // Heading styles
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

    // Paragraph styles
    :deep(p) {
      margin-bottom: 1em;
      line-height: 1.8;
    }

    // List styles
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

    // Link styles
    :deep(a) {
      color: rgb(var(--v-theme-primary));
      text-decoration: none;
      border-bottom: 1px solid transparent;
      transition: border-color 0.2s;

      &:hover {
        border-bottom-color: rgb(var(--v-theme-primary));
      }
    }

    // Code block styles
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

    // Inline code styles
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

    // highlight.js syntax highlighting styles
    :deep(.hljs) {
      display: block;
      overflow-x: auto;
      padding: 0.5em;
      background: transparent;
    }

    // Blockquote styles
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

    // Separator styles
    :deep(hr) {
      border: none;
      border-top: 2px solid rgba(var(--v-theme-on-surface), 0.1);
      margin: 2em 0;
    }

    // Table styles
    :deep(.table-container) {
      width: 100%;
      overflow-x: auto;
      margin: 1em 0;
      border-radius: 4px;
      border: 1px solid rgba(var(--v-theme-on-surface), 0.1);

      table {
        width: 100%;
        min-width: 600px; // Ensure table doesn't get too squashed
        border-collapse: collapse;
        margin: 0;

        th,
        td {
          border: 1px solid rgba(var(--v-theme-on-surface), 0.2);
          padding: 0.75em 1em;
          text-align: left;
          word-break: normal;
        }

        th {
          background-color: rgba(var(--v-theme-on-surface), 0.05);
          font-weight: 600;
          white-space: nowrap;
        }

        tr:nth-child(even) {
          background-color: rgba(var(--v-theme-on-surface), 0.02);
        }
      }
    }

    // Image styles
    :deep(img) {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 1em 0;
    }

    // Emphasis styles
    :deep(strong) {
      font-weight: 600;
    }

    :deep(em) {
      font-style: italic;
    }

    // Strikethrough styles
    :deep(del) {
      text-decoration: line-through;
      opacity: 0.7;
    }

    // Empty state styles
    :deep(.empty-state) {
      color: rgba(var(--v-theme-on-surface), 0.5);
      text-align: center;
      padding: 3em 1em;
      font-style: italic;
    }

    // Error state styles
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

    // Mermaid chart container styles
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

  // Mermaid container in dark theme
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

  // Dark theme variants
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

  // Custom scrollbar styles
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
