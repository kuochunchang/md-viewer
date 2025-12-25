<template>
  <div class="markdown-editor">
    <textarea
      ref="textareaRef"
      v-model="localContent"
      class="editor-textarea"
      :style="{ fontSize: fontSize + 'px' }"
      placeholder="Enter Markdown content here..."
      @input="handleInput"
      @scroll="handleScroll"
    ></textarea>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

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
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.editor-textarea {
  width: 100%;
  height: 100%;
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
