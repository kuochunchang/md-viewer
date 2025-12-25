<template>
  <div
    class="tab-item"
    :class="{ active: isActive, editing: isEditing }"
    @click="handleClick"
    @dblclick="handleDoubleClick"
    :title="tab.name"
  >
    <div class="tab-content">
      <!-- Icon/Status Indicator can go here -->
      <v-icon size="14" class="mr-1 tab-icon" :color="isActive ? 'primary' : 'grey'">mdi-file-document-outline</v-icon>
      
      <input
        v-if="isEditing"
        ref="nameInputRef"
        v-model="editingName"
        class="tab-name-input"
        @blur="handleBlur"
        @keyup.enter="handleBlur"
        @keyup.esc="handleCancel"
        @click.stop
      />
      <span v-else class="tab-name">{{ displayName }}</span>
    </div>

    <v-btn
      icon
      variant="text"
      size="x-small"
      class="tab-close-btn"
      @click.stop="handleClose"
    >
      <v-icon size="14">mdi-close</v-icon>
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
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

const isEditing = ref(false)
const editingName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

const displayName = computed(() => {
  if (props.tab.name.length > 30) {
    return props.tab.name.slice(0, 30) + '...'
  }
  return props.tab.name
})

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
@import '../styles/variables.scss';

.tab-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  flex: 0 0 auto; // Don't shrink, don't grow, just be natural width (scrolling handled by parent)
  min-width: 120px;
  max-width: 400px; // Allow wide tabs up to ~30-40 chars
  height: 36px;
  
  padding: 0 8px 0 16px; // Increased left padding slightly
  margin-right: 2px;
  
  background: transparent;
  color: var(--text-secondary);
  border-radius: 16px 16px 0 0; // Very rounded corners
  
  cursor: pointer;
  user-select: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.85rem;

  // Inactive state - subtle separator
  &:not(.active):not(:hover)::after {
    content: '';
    position: absolute;
    right: 0;
    top: 30%;
    height: 40%;
    width: 1px;
    background-color: var(--border-color);
    opacity: 0.5;
  }

  // Hover state (inactive)
  &:hover:not(.active) {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
    
    // Hide separator on hover
    &::after {
      opacity: 0;
    }
  }

  // Active state
  &.active {
    background: var(--bg-app); // Matches the main content background
    color: var(--text-primary);
    position: relative;
    z-index: 1;
    font-weight: 600;
    // Use inset shadow for a perfect curve-hugging accent
    box-shadow: inset 0 3px 0 0 var(--primary-color), 0 -1px 2px rgba(0,0,0,0.03);

    // Hide separator for active
    &::after {
      display: none;
    }
    
    // Remove the pseudo-element solution
  }
}

.tab-content {
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
  margin-right: 4px;
}

.tab-icon {
  opacity: 0.7;
  .active & {
    opacity: 1;
  }
}

.tab-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  // font-weight matches parent
}

.tab-name-input {
  width: 100%;
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--primary-color);
  border-radius: var(--radius-sm);
  padding: 2px 4px;
  font-size: inherit;
  outline: none;
  box-shadow: var(--shadow-sm);
}

.tab-close-btn {
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.2s;
  color: var(--text-tertiary);
  width: 20px;
  height: 20px;

  .tab-item:hover & {
    opacity: 1;
    transform: scale(1);
  }
  
  .tab-item.active & {
    opacity: 1;
    transform: scale(1);
  }

  &:hover {
    background: rgba(0,0,0,0.1); 
    color: #ef4444; // Red on hover for close
    
    .v-theme--dark & {
      background: rgba(255,255,255,0.1);
    }
  }
}
</style>
