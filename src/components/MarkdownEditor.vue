<template>
  <div class="markdown-editor">
    <!-- Toolbar -->
    <div class="editor-toolbar">
      <div 
        ref="toolbarScrollRef"
        class="toolbar-scroll-container"
        :class="{ 'can-scroll-left': canScrollLeft, 'can-scroll-right': canScrollRight }"
        @mousedown="startToolbarDrag"
        @wheel.prevent="handleToolbarWheel"
      >
        <div class="toolbar-content">
          <div class="toolbar-group">
            <v-btn
              icon
              variant="text"
              size="small"
              title="粗體 (Bold)"
              @click="insertFormat('bold')"
            >
              <v-icon size="18">mdi-format-bold</v-icon>
            </v-btn>
            <v-btn
              icon
              variant="text"
              size="small"
              title="斜體 (Italic)"
              @click="insertFormat('italic')"
            >
              <v-icon size="18">mdi-format-italic</v-icon>
            </v-btn>
            <v-btn
              icon
              variant="text"
              size="small"
              title="底線 (Underline)"
              @click="insertFormat('underline')"
            >
              <v-icon size="18">mdi-format-underline</v-icon>
            </v-btn>
            <v-btn
              icon
              variant="text"
              size="small"
              title="刪除線 (Strikethrough)"
              @click="insertFormat('strikethrough')"
            >
              <v-icon size="18">mdi-format-strikethrough</v-icon>
            </v-btn>
          </div>
          
          <v-divider vertical class="toolbar-divider" />
          
          <div class="toolbar-group">
            <v-btn
              variant="text"
              size="small"
              title="標題 1"
              class="heading-btn"
              @click="insertFormat('h1')"
            >
              H1
            </v-btn>
            <v-btn
              variant="text"
              size="small"
              title="標題 2"
              class="heading-btn"
              @click="insertFormat('h2')"
            >
              H2
            </v-btn>
            <v-btn
              variant="text"
              size="small"
              title="標題 3"
              class="heading-btn"
              @click="insertFormat('h3')"
            >
              H3
            </v-btn>
          </div>
          
          <v-divider vertical class="toolbar-divider" />
          
          <div class="toolbar-group">
            <v-btn
              icon
              variant="text"
              size="small"
              title="項目符號列表 (Bullet List)"
              @click="insertFormat('bullet')"
            >
              <v-icon size="18">mdi-format-list-bulleted</v-icon>
            </v-btn>
            <v-btn
              icon
              variant="text"
              size="small"
              title="編號列表 (Numbered List)"
              @click="insertFormat('numbered')"
            >
              <v-icon size="18">mdi-format-list-numbered</v-icon>
            </v-btn>
          </div>
          
          <v-divider vertical class="toolbar-divider" />
          
          <!-- Format Markdown Button -->
          <v-btn
            icon
            variant="text"
            size="small"
            :title="isFormatting ? 'Formatting...' : 'Format Markdown'"
            :loading="isFormatting"
            @click="formatMarkdown"
          >
            <v-icon size="18">mdi-auto-fix</v-icon>
          </v-btn>
          
          <!-- Copy Button -->
          <v-btn
            icon
            variant="text"
            size="small"
            :title="copied ? 'Copied!' : 'Copy Markdown'"
            :color="copied ? 'success' : undefined"
            @click="copyToClipboard"
          >
            <v-icon size="18">{{ copied ? 'mdi-check' : 'mdi-content-copy' }}</v-icon>
          </v-btn>
          
          <v-divider vertical class="toolbar-divider" />
          
          <!-- Undo/Redo Buttons -->
          <div class="toolbar-group">
            <v-btn
              icon
              variant="text"
              size="small"
              title="復原 (Ctrl+Z)"
              :disabled="!canUndo"
              @click="undo"
            >
              <v-icon size="18">mdi-undo</v-icon>
            </v-btn>
            <v-btn
              icon
              variant="text"
              size="small"
              title="重做 (Ctrl+Shift+Z)"
              :disabled="!canRedo"
              @click="redo"
            >
              <v-icon size="18">mdi-redo</v-icon>
            </v-btn>
          </div>
        </div>
      </div>
    </div>
    
    <textarea
      ref="textareaRef"
      v-model="localContent"
      class="editor-textarea"
      :style="{ fontSize: fontSize + 'px' }"
      placeholder="Enter Markdown content here..."
      @input="handleInput"
      @scroll="handleScroll"
      @keydown="handleKeydown"
      @contextmenu="handleContextMenu"
    ></textarea>

    <!-- AI Context Menu -->
    <v-menu
      v-model="showContextMenu"
      :target="contextMenuPosition"
      location="top start"
      :close-on-content-click="true"
    >
      <v-list density="compact" class="ai-context-menu">
        <v-list-subheader>AI Assistant</v-list-subheader>
        <v-list-item
          prepend-icon="mdi-auto-fix"
          title="✨ Improve with AI"
          subtitle="Quick improvement"
          :disabled="!geminiAI.isApiKeySet.value || geminiAI.isProcessing.value"
          @click="handleImproveText"
        ></v-list-item>
        <v-list-item
          prepend-icon="mdi-chat"
          title="💬 Edit with AI Chat..."
          subtitle="Open dialog for detailed editing"
          :disabled="!geminiAI.isApiKeySet.value"
          @click="handleOpenAIDialog"
        ></v-list-item>
        <v-divider v-if="!geminiAI.isApiKeySet.value"></v-divider>
        <v-list-item
          v-if="!geminiAI.isApiKeySet.value"
          prepend-icon="mdi-key"
          title="Configure API Key"
          subtitle="Set up in Settings"
          @click="$emit('openSettings')"
        ></v-list-item>
      </v-list>
    </v-menu>

    <!-- AI Processing Indicator -->
    <v-snackbar
      v-model="showProcessingIndicator"
      :timeout="-1"
      color="primary"
      location="top"
    >
      <div class="d-flex align-center gap-2">
        <v-progress-circular indeterminate size="20" width="2"></v-progress-circular>
        <span>AI is improving your text...</span>
      </div>
    </v-snackbar>

    <!-- AI Assistant Dialog -->
    <AIAssistantDialog
      v-model="showAIDialog"
      :selected-text="selectedTextForAI"
      @apply="handleApplyAIText"
    />
  </div>
</template>

<script setup lang="ts">
import markdownPlugin from 'prettier/plugins/markdown';
import { format as prettierFormat } from 'prettier/standalone';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useGeminiAI } from '../composables/useGeminiAI';
import { useTabsStore } from '../stores/tabsStore';
import AIAssistantDialog from './AIAssistantDialog.vue';

interface Props {
  modelValue: string
  fontSize?: number
  tabId: string  // Required for per-tab history management
}

const props = withDefaults(defineProps<Props>(), {
  fontSize: 14
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'scroll': [ratio: number]
  'openSettings': []
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const localContent = ref(props.modelValue)

// Toolbar scroll functionality
const toolbarScrollRef = ref<HTMLDivElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
const isDraggingToolbar = ref(false)
const dragStartX = ref(0)
const scrollStartX = ref(0)

const updateScrollIndicators = () => {
  const el = toolbarScrollRef.value
  if (!el) return
  
  canScrollLeft.value = el.scrollLeft > 0
  canScrollRight.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 1
}

const handleToolbarWheel = (e: WheelEvent) => {
  const el = toolbarScrollRef.value
  if (!el) return
  
  // Convert vertical scroll to horizontal
  el.scrollLeft += e.deltaY || e.deltaX
  updateScrollIndicators()
}

const startToolbarDrag = (e: MouseEvent) => {
  const el = toolbarScrollRef.value
  if (!el) return
  
  // Only start drag if there's overflow
  if (el.scrollWidth <= el.clientWidth) return
  
  isDraggingToolbar.value = true
  dragStartX.value = e.clientX
  scrollStartX.value = el.scrollLeft
  
  el.style.cursor = 'grabbing'
  el.style.userSelect = 'none'
  
  document.addEventListener('mousemove', handleToolbarDragMove)
  document.addEventListener('mouseup', stopToolbarDrag)
}

const handleToolbarDragMove = (e: MouseEvent) => {
  if (!isDraggingToolbar.value) return
  
  const el = toolbarScrollRef.value
  if (!el) return
  
  const dx = e.clientX - dragStartX.value
  el.scrollLeft = scrollStartX.value - dx
  updateScrollIndicators()
}

const stopToolbarDrag = () => {
  isDraggingToolbar.value = false
  
  const el = toolbarScrollRef.value
  if (el) {
    el.style.cursor = ''
    el.style.userSelect = ''
  }
  
  document.removeEventListener('mousemove', handleToolbarDragMove)
  document.removeEventListener('mouseup', stopToolbarDrag)
}

onMounted(() => {
  // Initial check for scroll indicators
  setTimeout(updateScrollIndicators, 100)
  
  // Update on resize
  window.addEventListener('resize', updateScrollIndicators)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScrollIndicators)
  document.removeEventListener('mousemove', handleToolbarDragMove)
  document.removeEventListener('mouseup', stopToolbarDrag)
})

// AI features
const geminiAI = useGeminiAI()
const showContextMenu = ref(false)
const contextMenuPosition = ref<[number, number]>([0, 0])
const selectedTextForAI = ref('')
const selectionRange = ref<{ start: number; end: number } | null>(null)
const showAIDialog = ref(false)
const showProcessingIndicator = computed(() => geminiAI.isProcessing.value)

// Per-tab history management using store
const tabsStore = useTabsStore()
const isUndoRedo = ref(false)

// Computed properties for undo/redo availability
const canUndo = computed(() => props.tabId ? tabsStore.canUndoTab(props.tabId) : false)
const canRedo = computed(() => props.tabId ? tabsStore.canRedoTab(props.tabId) : false)

const pushHistory = (content: string, cursorPos: number) => {
  // Don't push if we're in the middle of an undo/redo operation
  if (isUndoRedo.value || !props.tabId) return
  
  tabsStore.pushTabHistory(props.tabId, content, cursorPos)
}

const undo = () => {
  if (!canUndo.value || !props.tabId) return
  
  isUndoRedo.value = true
  const state = tabsStore.undoTab(props.tabId)
  
  if (state) {
    localContent.value = state.content
    emit('update:modelValue', state.content)
    
    setTimeout(() => {
      const textarea = textareaRef.value
      if (textarea) {
        textarea.focus()
        textarea.setSelectionRange(state.cursorPos, state.cursorPos)
      }
      isUndoRedo.value = false
    }, 0)
  } else {
    isUndoRedo.value = false
  }
}

const redo = () => {
  if (!canRedo.value || !props.tabId) return
  
  isUndoRedo.value = true
  const state = tabsStore.redoTab(props.tabId)
  
  if (state) {
    localContent.value = state.content
    emit('update:modelValue', state.content)
    
    setTimeout(() => {
      const textarea = textareaRef.value
      if (textarea) {
        textarea.focus()
        textarea.setSelectionRange(state.cursorPos, state.cursorPos)
      }
      isUndoRedo.value = false
    }, 0)
  } else {
    isUndoRedo.value = false
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  // Ctrl+Z or Cmd+Z for Undo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    undo()
    return
  }
  
  // Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y or Cmd+Y for Redo
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    redo()
    return
  }
}

// Format Markdown functionality
const isFormatting = ref(false)

const formatMarkdown = async () => {
  if (isFormatting.value) return
  
  try {
    isFormatting.value = true
    const textarea = textareaRef.value
    const cursorPos = textarea?.selectionStart ?? 0
    
    const formatted = await prettierFormat(localContent.value, {
      parser: 'markdown',
      plugins: [markdownPlugin],
      proseWrap: 'preserve',
      tabWidth: 2,
    })
    
    localContent.value = formatted
    emit('update:modelValue', formatted)
    pushHistory(formatted, Math.min(cursorPos, formatted.length))
    
    // Restore cursor position
    setTimeout(() => {
      if (textarea) {
        textarea.focus()
        const newPos = Math.min(cursorPos, formatted.length)
        textarea.setSelectionRange(newPos, newPos)
      }
    }, 0)
  } catch (err) {
    console.error('Failed to format markdown:', err)
  } finally {
    isFormatting.value = false
  }
}

// Copy to clipboard functionality
const copied = ref(false)

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(localContent.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

// Format insertion functionality
type FormatType = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered'

// Helper function to check if text is wrapped with markers
const isWrappedWith = (text: string, prefix: string, suffix: string): boolean => {
  return text.startsWith(prefix) && text.endsWith(suffix) && text.length >= prefix.length + suffix.length
}

// Helper function to check surrounding context for inline formats
const checkSurroundingFormat = (before: string, after: string, prefix: string, suffix: string): boolean => {
  return before.endsWith(prefix) && after.startsWith(suffix)
}

const insertFormat = (type: FormatType) => {
  const textarea = textareaRef.value
  if (!textarea) return
  
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = localContent.value.substring(start, end)
  const beforeText = localContent.value.substring(0, start)
  const afterText = localContent.value.substring(end)
  
  let newText = ''
  let cursorOffset = 0
  let newSelectionStart = start
  let newSelectionEnd = end
  
  // Find the start and end of the current line
  const lineStart = beforeText.lastIndexOf('\n') + 1
  const lineEnd = afterText.indexOf('\n')
  const beforeLine = localContent.value.substring(0, lineStart)
  const currentLineBeforeCursor = beforeText.substring(lineStart)
  const currentLineAfterCursor = lineEnd === -1 ? afterText : afterText.substring(0, lineEnd)
  const afterLine = lineEnd === -1 ? '' : afterText.substring(lineEnd)
  const fullCurrentLine = currentLineBeforeCursor + selectedText + currentLineAfterCursor
  
  switch (type) {
    case 'bold': {
      const prefix = '**'
      const suffix = '**'
      
      // Check if selected text is already bold (wrapped with **)
      if (selectedText && isWrappedWith(selectedText, prefix, suffix)) {
        // Remove bold from selected text
        const unwrapped = selectedText.slice(2, -2)
        newText = beforeText + unwrapped + afterText
        newSelectionStart = start
        newSelectionEnd = start + unwrapped.length
        cursorOffset = newSelectionEnd
      }
      // Check if surrounding context has bold markers
      else if (checkSurroundingFormat(beforeText, afterText, prefix, suffix)) {
        // Remove bold markers from surrounding
        newText = beforeText.slice(0, -2) + selectedText + afterText.slice(2)
        newSelectionStart = start - 2
        newSelectionEnd = newSelectionStart + selectedText.length
        cursorOffset = newSelectionEnd
      }
      // Add bold
      else if (selectedText) {
        newText = beforeText + prefix + selectedText + suffix + afterText
        newSelectionStart = start + 2
        newSelectionEnd = newSelectionStart + selectedText.length
        cursorOffset = end + 4
      } else {
        newText = beforeText + '**文字**' + afterText
        newSelectionStart = start + 2
        newSelectionEnd = start + 4
        cursorOffset = start + 4
      }
      break
    }
    case 'italic': {
      const prefix = '*'
      const suffix = '*'
      
      // Check if selected text is already italic (wrapped with single *)
      // Be careful not to match bold (**)
      if (selectedText && selectedText.startsWith('*') && !selectedText.startsWith('**') && 
          selectedText.endsWith('*') && !selectedText.endsWith('**') && selectedText.length >= 2) {
        const unwrapped = selectedText.slice(1, -1)
        newText = beforeText + unwrapped + afterText
        newSelectionStart = start
        newSelectionEnd = start + unwrapped.length
        cursorOffset = newSelectionEnd
      }
      // Check surrounding - be careful with bold
      else if (beforeText.endsWith('*') && !beforeText.endsWith('**') && 
               afterText.startsWith('*') && !afterText.startsWith('**')) {
        newText = beforeText.slice(0, -1) + selectedText + afterText.slice(1)
        newSelectionStart = start - 1
        newSelectionEnd = newSelectionStart + selectedText.length
        cursorOffset = newSelectionEnd
      }
      // Add italic
      else if (selectedText) {
        newText = beforeText + prefix + selectedText + suffix + afterText
        newSelectionStart = start + 1
        newSelectionEnd = newSelectionStart + selectedText.length
        cursorOffset = end + 2
      } else {
        newText = beforeText + '*文字*' + afterText
        newSelectionStart = start + 1
        newSelectionEnd = start + 3
        cursorOffset = start + 3
      }
      break
    }
    case 'underline': {
      const prefix = '<u>'
      const suffix = '</u>'
      
      if (selectedText && isWrappedWith(selectedText, prefix, suffix)) {
        const unwrapped = selectedText.slice(3, -4)
        newText = beforeText + unwrapped + afterText
        newSelectionStart = start
        newSelectionEnd = start + unwrapped.length
        cursorOffset = newSelectionEnd
      }
      else if (checkSurroundingFormat(beforeText, afterText, prefix, suffix)) {
        newText = beforeText.slice(0, -3) + selectedText + afterText.slice(4)
        newSelectionStart = start - 3
        newSelectionEnd = newSelectionStart + selectedText.length
        cursorOffset = newSelectionEnd
      }
      else if (selectedText) {
        newText = beforeText + prefix + selectedText + suffix + afterText
        newSelectionStart = start + 3
        newSelectionEnd = newSelectionStart + selectedText.length
        cursorOffset = end + 7
      } else {
        newText = beforeText + '<u>文字</u>' + afterText
        newSelectionStart = start + 3
        newSelectionEnd = start + 5
        cursorOffset = start + 5
      }
      break;
    }
    case 'strikethrough': {
      const prefix = '~~'
      const suffix = '~~'
      
      if (selectedText && isWrappedWith(selectedText, prefix, suffix)) {
        const unwrapped = selectedText.slice(2, -2)
        newText = beforeText + unwrapped + afterText
        newSelectionStart = start
        newSelectionEnd = start + unwrapped.length
        cursorOffset = newSelectionEnd
      }
      else if (checkSurroundingFormat(beforeText, afterText, prefix, suffix)) {
        newText = beforeText.slice(0, -2) + selectedText + afterText.slice(2)
        newSelectionStart = start - 2
        newSelectionEnd = newSelectionStart + selectedText.length
        cursorOffset = newSelectionEnd
      }
      else if (selectedText) {
        newText = beforeText + prefix + selectedText + suffix + afterText
        newSelectionStart = start + 2
        newSelectionEnd = newSelectionStart + selectedText.length
        cursorOffset = end + 4
      } else {
        newText = beforeText + '~~文字~~' + afterText
        newSelectionStart = start + 2
        newSelectionEnd = start + 4
        cursorOffset = start + 4
      }
      break
    }
    case 'h1': {
      const prefix = '# '
      if (fullCurrentLine.startsWith(prefix)) {
        // Remove h1
        const newLineContent = fullCurrentLine.slice(2)
        newText = beforeLine + newLineContent + afterLine
        cursorOffset = Math.max(lineStart, start - 2)
        newSelectionStart = cursorOffset
        newSelectionEnd = cursorOffset
      } else {
        // Remove other headings first if present
        let lineContent = fullCurrentLine
        if (lineContent.startsWith('### ')) lineContent = lineContent.slice(4)
        else if (lineContent.startsWith('## ')) lineContent = lineContent.slice(3)
        else if (lineContent.startsWith('# ')) lineContent = lineContent.slice(2)
        
        newText = beforeLine + prefix + lineContent + afterLine
        cursorOffset = start + 2
        newSelectionStart = cursorOffset
        newSelectionEnd = cursorOffset
      }
      break
    }
    case 'h2': {
      const prefix = '## '
      if (fullCurrentLine.startsWith(prefix)) {
        const newLineContent = fullCurrentLine.slice(3)
        newText = beforeLine + newLineContent + afterLine
        cursorOffset = Math.max(lineStart, start - 3)
        newSelectionStart = cursorOffset
        newSelectionEnd = cursorOffset
      } else {
        let lineContent = fullCurrentLine
        if (lineContent.startsWith('### ')) lineContent = lineContent.slice(4)
        else if (lineContent.startsWith('## ')) lineContent = lineContent.slice(3)
        else if (lineContent.startsWith('# ')) lineContent = lineContent.slice(2)
        
        newText = beforeLine + prefix + lineContent + afterLine
        cursorOffset = start + 3
        newSelectionStart = cursorOffset
        newSelectionEnd = cursorOffset
      }
      break
    }
    case 'h3': {
      const prefix = '### '
      if (fullCurrentLine.startsWith(prefix)) {
        const newLineContent = fullCurrentLine.slice(4)
        newText = beforeLine + newLineContent + afterLine
        cursorOffset = Math.max(lineStart, start - 4)
        newSelectionStart = cursorOffset
        newSelectionEnd = cursorOffset
      } else {
        let lineContent = fullCurrentLine
        if (lineContent.startsWith('### ')) lineContent = lineContent.slice(4)
        else if (lineContent.startsWith('## ')) lineContent = lineContent.slice(3)
        else if (lineContent.startsWith('# ')) lineContent = lineContent.slice(2)
        
        newText = beforeLine + prefix + lineContent + afterLine
        cursorOffset = start + 4
        newSelectionStart = cursorOffset
        newSelectionEnd = cursorOffset
      }
      break
    }
    case 'bullet': {
      const prefix = '- '
      if (fullCurrentLine.startsWith(prefix)) {
        const newLineContent = fullCurrentLine.slice(2)
        newText = beforeLine + newLineContent + afterLine
        cursorOffset = Math.max(lineStart, start - 2)
        newSelectionStart = cursorOffset
        newSelectionEnd = cursorOffset
      } else {
        // Remove numbered list if present
        let lineContent = fullCurrentLine
        const numberedMatch = lineContent.match(/^\d+\.\s/)
        if (numberedMatch) lineContent = lineContent.slice(numberedMatch[0].length)
        
        newText = beforeLine + prefix + lineContent + afterLine
        cursorOffset = start + 2
        newSelectionStart = cursorOffset
        newSelectionEnd = cursorOffset
      }
      break
    }
    case 'numbered': {
      const prefix = '1. '
      const numberedRegex = /^\d+\.\s/
      if (numberedRegex.test(fullCurrentLine)) {
        const match = fullCurrentLine.match(numberedRegex)
        const newLineContent = fullCurrentLine.slice(match![0].length)
        newText = beforeLine + newLineContent + afterLine
        cursorOffset = Math.max(lineStart, start - match![0].length)
        newSelectionStart = cursorOffset
        newSelectionEnd = cursorOffset
      } else {
        // Remove bullet if present
        let lineContent = fullCurrentLine
        if (lineContent.startsWith('- ')) lineContent = lineContent.slice(2)
        
        newText = beforeLine + prefix + lineContent + afterLine
        cursorOffset = start + 3
        newSelectionStart = cursorOffset
        newSelectionEnd = cursorOffset
      }
      break
    }
  }
  
  localContent.value = newText
  emit('update:modelValue', newText)
  pushHistory(newText, cursorOffset)
  
  // Restore cursor position and selection
  setTimeout(() => {
    textarea.focus()
    textarea.setSelectionRange(newSelectionStart, newSelectionEnd)
  }, 0)
}

// Listen to external content changes
watch(() => props.modelValue, (newValue) => {
  if (newValue !== localContent.value) {
    localContent.value = newValue
  }
})

const handleInput = (e: Event) => {
  const target = e.target as HTMLTextAreaElement
  localContent.value = target.value
  emit('update:modelValue', target.value)
  pushHistory(target.value, target.selectionStart)
}

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement
  if (!target) return
  
  const ratio = target.scrollTop / (target.scrollHeight - target.clientHeight)
  emit('scroll', ratio)
}

// Expose method for external scrolling
const scrollToRatio = (ratio: number) => {
  const textarea = textareaRef.value
  if (!textarea) return
  
  const targetScrollTop = ratio * (textarea.scrollHeight - textarea.clientHeight)
  // Check if difference is significant to avoid jitter
  if (Math.abs(textarea.scrollTop - targetScrollTop) > 5) {
    textarea.scrollTop = targetScrollTop
  }
}

// AI Context Menu handlers
const handleContextMenu = (e: MouseEvent) => {
  const textarea = textareaRef.value
  if (!textarea) return
  
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  
  // Only show AI menu if there's a selection
  if (start === end) return
  
  e.preventDefault()
  
  // Store selection info
  selectedTextForAI.value = localContent.value.substring(start, end)
  selectionRange.value = { start, end }
  
  // Position the menu at the mouse location
  contextMenuPosition.value = [e.clientX, e.clientY]
  showContextMenu.value = true
}

const handleImproveText = async () => {
  if (!selectedTextForAI.value || !selectionRange.value) return
  
  try {
    const improvedText = await geminiAI.improveText(selectedTextForAI.value)
    
    // Replace the selected text with improved version
    const before = localContent.value.substring(0, selectionRange.value.start)
    const after = localContent.value.substring(selectionRange.value.end)
    const newContent = before + improvedText + after
    
    localContent.value = newContent
    emit('update:modelValue', newContent)
    pushHistory(newContent, selectionRange.value.start + improvedText.length)
    
    // Clear selection info
    selectionRange.value = null
    selectedTextForAI.value = ''
  } catch (e) {
    console.error('Failed to improve text:', e)
  }
}

const handleOpenAIDialog = () => {
  showAIDialog.value = true
}

const handleApplyAIText = (newText: string) => {
  if (!selectionRange.value) return
  
  // Replace the selected text with the AI-generated text
  const before = localContent.value.substring(0, selectionRange.value.start)
  const after = localContent.value.substring(selectionRange.value.end)
  const newContent = before + newText + after
  
  localContent.value = newContent
  emit('update:modelValue', newContent)
  pushHistory(newContent, selectionRange.value.start + newText.length)
  
  // Clear selection info
  selectionRange.value = null
  selectedTextForAI.value = ''
}

defineExpose({
  scrollToRatio
})
</script>

<style scoped lang="scss">
.markdown-editor {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  background-color: rgba(var(--v-theme-surface), 0.5);
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
  
  // Scroll container
  .toolbar-scroll-container {
    display: flex;
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none; // Firefox
    -ms-overflow-style: none; // IE/Edge
    cursor: grab;
    position: relative;
    
    &::-webkit-scrollbar {
      display: none; // Chrome/Safari
    }
    
    // Scroll fade indicators
    &.can-scroll-left::before,
    &.can-scroll-right::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      width: 20px;
      pointer-events: none;
      z-index: 1;
    }
    
    &.can-scroll-left::before {
      left: 0;
      background: linear-gradient(to right, rgba(var(--v-theme-surface), 0.9), transparent);
    }
    
    &.can-scroll-right::after {
      right: 0;
      background: linear-gradient(to left, rgba(var(--v-theme-surface), 0.9), transparent);
    }
  }
  
  .toolbar-content {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  
  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }
  
  .toolbar-divider {
    height: 24px;
    margin: 0 8px;
    opacity: 0.3;
    flex-shrink: 0;
  }
  
  .heading-btn {
    min-width: 36px;
    font-weight: 600;
    font-size: 12px;
  }
  
  .v-btn {
    opacity: 0.7;
    transition: opacity 0.2s ease, background-color 0.2s ease;
    flex-shrink: 0;
    
    &:hover {
      opacity: 1;
      background-color: rgba(var(--v-theme-on-surface), 0.08);
    }
  }
}

.editor-textarea {
  width: 100%;
  flex: 1;
  padding: 16px;
  border: none;
  outline: none;
  resize: none;
  font-family: 'Courier New', 'Monaco', 'Menlo', monospace;
  line-height: 1.6;
  background-color: transparent;
  color: rgb(var(--v-theme-on-surface));
  overflow-y: auto;

  // RWD: Mobile layout adjustments
  @media (max-width: 600px) {
    padding: 12px;
    line-height: 1.5;
  }

  &::placeholder {
    color: rgba(var(--v-theme-on-surface), 0.4);
  }

  &:focus {
    outline: none;
  }

  // Custom scrollbar styling
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

// AI Context Menu styling
.ai-context-menu {
  :deep(.v-list-subheader) {
    font-size: 11px;
    min-height: 28px;
    padding-top: 4px;
    padding-bottom: 4px;
  }
  
  :deep(.v-list-item) {
    min-height: 36px;
    padding-top: 4px;
    padding-bottom: 4px;
  }
  
  :deep(.v-list-item-title) {
    font-size: 13px;
  }
  
  :deep(.v-list-item-subtitle) {
    font-size: 11px;
  }
  
  :deep(.v-list-item__prepend .v-icon) {
    font-size: 18px;
  }
}
</style>
