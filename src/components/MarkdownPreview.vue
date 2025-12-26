<template>
  <div class="markdown-preview-wrapper">
    <!-- Copy Button -->
    <v-btn
      icon
      variant="text"
      size="small"
      class="copy-btn"
      :title="copied ? 'Copied!' : 'Copy for Google Docs'"
      :color="copied ? 'success' : undefined"
      @click="copyToClipboard"
    >
      <v-icon size="18">{{ copied ? 'mdi-check' : 'mdi-content-copy' }}</v-icon>
    </v-btn>
    
    <div
      ref="containerRef"
      class="markdown-preview"
      :style="{ fontSize: fontSize + 'px' }"
      @scroll="handleScroll"
    >
      <div
        ref="previewContentRef"
        class="preview-content"
        v-html="renderedHtml"
      ></div>
    </div>
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

// Copy to clipboard functionality
const copied = ref(false)

const copyToClipboard = async () => {
  try {
    // Clone the content to modify without affecting the original
    const clonedContent = previewContentRef.value?.cloneNode(true) as HTMLElement
    if (!clonedContent) return
    
    // Add inline styles to tables for Google Docs compatibility
    const tables = clonedContent.querySelectorAll('table')
    tables.forEach(table => {
      table.style.borderCollapse = 'collapse'
      table.style.width = '100%'
      table.style.marginBottom = '16px'
    })
    
    // Add inline styles to table headers
    const ths = clonedContent.querySelectorAll('th')
    ths.forEach(th => {
      th.style.border = '1px solid #ccc'
      th.style.padding = '8px 12px'
      th.style.backgroundColor = '#f5f5f5'
      th.style.fontWeight = 'bold'
      th.style.textAlign = 'left'
    })
    
    // Add inline styles to table cells
    const tds = clonedContent.querySelectorAll('td')
    tds.forEach(td => {
      td.style.border = '1px solid #ccc'
      td.style.padding = '8px 12px'
    })
    
    // Add inline styles to code elements
    const codes = clonedContent.querySelectorAll('code')
    codes.forEach(code => {
      code.style.backgroundColor = '#f0f0f0'
      code.style.padding = '2px 6px'
      code.style.borderRadius = '4px'
      code.style.fontFamily = 'monospace'
      code.style.fontSize = '0.9em'
    })
    
    const htmlContent = clonedContent.innerHTML
    
    // Create a ClipboardItem with HTML content so it can be pasted
    // into Google Docs with proper formatting preserved
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const clipboardItem = new ClipboardItem({
      'text/html': blob,
      'text/plain': new Blob([previewContentRef.value?.innerText || ''], { type: 'text/plain' })
    })
    
    await navigator.clipboard.write([clipboardItem])
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

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
// Reference to preview container (scrolling element)
const containerRef = ref<HTMLElement | null>(null)

const emit = defineEmits<{
  'scroll': [ratio: number]
}>()

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement
  if (!target) return
  
  const ratio = target.scrollTop / (target.scrollHeight - target.clientHeight)
  emit('scroll', ratio)
}

const scrollToRatio = (ratio: number) => {
  const container = containerRef.value
  if (!container) return
  
  const targetScrollTop = ratio * (container.scrollHeight - container.clientHeight)
  if (Math.abs(container.scrollTop - targetScrollTop) > 5) {
    container.scrollTop = targetScrollTop
  }
}

defineExpose({
  scrollToRatio
})
</script>

<style scoped lang="scss">
@import '../styles/preview.scss';

.markdown-preview-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.copy-btn {
  position: absolute;
  top: 8px;
  right: 12px;
  z-index: 10;
  opacity: 0.6;
  transition: opacity 0.2s ease;
  background-color: var(--bg-surface);
  
  &:hover {
    opacity: 1;
  }
}

.markdown-preview {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 32px 0; // Vertical padding only, horiz handled by inner 92% width
  background-color: var(--bg-canvas); // Darker background to pop the paper
  
  // Custom scrollbar
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: rgba(0,0,0,0.1);
    border-radius: 4px;
    
    .v-theme--dark & {
      background-color: rgba(255,255,255,0.1);
    }

    &:hover {
      background-color: rgba(0,0,0,0.2);
      
      .v-theme--dark & {
        background-color: rgba(255,255,255,0.2);
      }
    }
  }
}

// NOTE: Typography and Paper styles are in src/styles/preview.scss targeting .preview-content
</style>
