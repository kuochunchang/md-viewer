<template>
  <div
    class="tab-item"
    :class="{ active: isActive, editing: isEditing, 'is-dark': isDark }"
    @click="handleClick"
    @dblclick="handleDoubleClick"
  >
    <input
      v-if="isEditing"
      ref="nameInputRef"
      v-model="editingName"
      class="tab-name-input"
      @blur="handleBlur"
      @keyup.enter="handleBlur"
      @keyup.esc="handleCancel"
    />
    <span v-else class="tab-name">{{ tab.name }}</span>
    <v-btn
      icon
      variant="text"
      size="x-small"
      class="tab-close-btn"
      @click.stop="handleClose"
    >
      <v-icon size="16">mdi-close</v-icon>
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import type { Tab } from '../types'

interface Props {
  tab: Tab
  isActive: boolean
}

interface Emits {
  (e: 'select', id: string): void
  (e: 'close', id: string): void
  (e: 'rename', id: string, name: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const theme = useTheme()

const isDark = computed(() => theme.global.current.value.dark)

const isEditing = ref(false)
const editingName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

watch(isEditing, async (newVal) => {
  if (newVal) {
    editingName.value = props.tab.name
    await nextTick()
    nameInputRef.value?.focus()
    nameInputRef.value?.select()
  }
})

function handleClick() {
  if (!isEditing.value) {
    emit('select', props.tab.id)
  }
}

function handleDoubleClick() {
  if (!isEditing.value) {
    isEditing.value = true
  }
}

function handleBlur() {
  if (isEditing.value) {
    if (editingName.value.trim() && editingName.value !== props.tab.name) {
      emit('rename', props.tab.id, editingName.value)
    }
    isEditing.value = false
  }
}

function handleCancel() {
  isEditing.value = false
  editingName.value = props.tab.name
}

function handleClose() {
  emit('close', props.tab.id)
}
</script>

<style scoped lang="scss">
.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: transparent;
  border-right: 1px solid transparent; 
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  position: relative;
  min-width: 120px;
  max-width: 200px;
  height: 36px; 
  margin-top: 4px; 
  color: #616161; // 亮色模式預設文字顏色

  // RWD
  @media (max-width: 600px) {
    min-width: 90px;
    max-width: 140px;
    padding: 6px 12px;
    gap: 6px;
  }

  // 分隔線
  &::after {
    content: '';
    position: absolute;
    right: 0;
    top: 25%;
    height: 50%;
    width: 1px;
    background-color: #D4D4D4; // VS Code 分隔線顏色
    transition: opacity 0.2s;
  }

  &:hover {
    background-color: #E4E4E4; // 亮色模式 Hover
    &::after {
      opacity: 0; 
    }
  }

  &.active {
    background-color: #FFFFFF;
    color: #333333; // 亮色模式選取文字顏色
    box-shadow: none; 
    z-index: 1;

    &::after {
      display: none; 
    }
  }

  &.editing {
    background-color: #FFFFFF;
    border: 1px solid var(--v-theme-primary);
  }

  // 深色主題適配 (直接套用在類別上)
  &.is-dark {
    color: #969696; // 深色模式預設文字顏色

    &::after {
      background-color: #3F3F3F; 
    }

    &:hover {
      background-color: #2D2D2D; 
    }

    &.active {
      background-color: #1E1E1E; 
      color: #FFFFFF; 
    }

    &.editing {
      background-color: #1E1E1E;
      border-color: var(--v-theme-primary);
    }

    .tab-name-input {
      border-color: #555;
      color: #fff;
      &:focus {
          border-color: var(--v-theme-primary);
      }
    }

    .tab-close-btn:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }
}

.tab-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  
  // RWD
  @media (max-width: 600px) {
    font-size: 12px;
  }
}

.tab-name-input {
  flex: 1;
  background: transparent;
  border: 1px solid var(--v-theme-primary);
  border-radius: 4px;
  padding: 0 4px;
  color: inherit;
  font-size: 13px;
  outline: none;
  width: 100%;
}

.tab-close-btn {
  opacity: 0; 
  transform: scale(0.8);
  transition: all 0.2s ease;
  margin-right: -8px; 
  color: inherit; 

  .tab-item:hover & {
    opacity: 0.6;
    transform: scale(1);
  }

  .tab-item.active & {
    opacity: 0.6;
    transform: scale(1);
  }

  &:hover {
    opacity: 1 !important;
    background-color: rgba(0, 0, 0, 0.08);
  }
}
</style>
