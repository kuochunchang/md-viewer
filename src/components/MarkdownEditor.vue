<template>
  <div class="markdown-editor">
    <!-- Toolbar -->
    <div class="editor-toolbar">
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
      
      <v-spacer />
      
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
    
    <textarea
      ref="textareaRef"
      v-model="localContent"
      class="editor-textarea"
      :style="{ fontSize: fontSize + 'px' }"
      placeholder="Enter Markdown content here..."
      @input="handleInput"
      @scroll="handleScroll"
      @keydown="handleKeydown"
    ></textarea>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';

interface Props {
  modelValue: string
  fontSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  fontSize: 14
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'scroll': [ratio: number]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const localContent = ref(props.modelValue)

// History management for Undo/Redo
interface HistoryState {
  content: string
  cursorPos: number
}

const historyStack = ref<HistoryState[]>([{ content: props.modelValue, cursorPos: 0 }])
const historyIndex = ref(0)
const isUndoRedo = ref(false)

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < historyStack.value.length - 1)

const pushHistory = (content: string, cursorPos: number) => {
  // Don't push if we're in the middle of an undo/redo operation
  if (isUndoRedo.value) return
  
  // Don't push if content hasn't changed
  if (historyStack.value[historyIndex.value]?.content === content) return
  
  // Remove any future history if we're not at the end
  if (historyIndex.value < historyStack.value.length - 1) {
    historyStack.value = historyStack.value.slice(0, historyIndex.value + 1)
  }
  
  historyStack.value.push({ content, cursorPos })
  historyIndex.value = historyStack.value.length - 1
  
  // Limit history size to 100 entries
  if (historyStack.value.length > 100) {
    historyStack.value.shift()
    historyIndex.value--
  }
}

const undo = () => {
  if (!canUndo.value) return
  
  isUndoRedo.value = true
  historyIndex.value--
  const state = historyStack.value[historyIndex.value]
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
}

const redo = () => {
  if (!canRedo.value) return
  
  isUndoRedo.value = true
  historyIndex.value++
  const state = historyStack.value[historyIndex.value]
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
type FormatType = 'bold' | 'italic' | 'underline' | 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered'

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
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  background-color: rgba(var(--v-theme-surface), 0.5);
  flex-shrink: 0;
  
  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  
  .toolbar-divider {
    height: 24px;
    margin: 0 8px;
    opacity: 0.3;
  }
  
  .heading-btn {
    min-width: 36px;
    font-weight: 600;
    font-size: 12px;
  }
  
  .v-btn {
    opacity: 0.7;
    transition: opacity 0.2s ease, background-color 0.2s ease;
    
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
</style>
