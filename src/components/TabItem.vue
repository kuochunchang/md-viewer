<template>
  <div
    class="tab-item"
    :class="{ active: isActive, editing: isEditing }"
    @click="handleClick"
    @dblclick="handleDoubleClick"
    @contextmenu.prevent="handleContextMenu"
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
        @keyup.enter="handleEnterKey"
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

    <!-- Right-click Context Menu -->
    <v-menu
      v-model="showContextMenu"
      :target="contextMenuPosition"
      location="bottom start"
      :close-on-content-click="true"
    >
      <v-list density="compact" class="tab-context-menu">
        <v-list-item
          prepend-icon="mdi-close"
          title="Close"
          @click="handleClose"
        />
        <v-divider />
        <v-list-item
          prepend-icon="mdi-close-box-multiple-outline"
          title="Close Others"
          @click="handleCloseOthers"
        />
        <v-list-item
          prepend-icon="mdi-arrow-collapse-right"
          title="Close to the Right"
          :disabled="!hasTabsToRight"
          @click="handleCloseToRight"
        />
        <v-divider />
        <v-list-item
          prepend-icon="mdi-close-circle-outline"
          title="Close All"
          @click="handleCloseAll"
        />
      </v-list>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useTabsStore } from '../stores/tabsStore'
import type { Tab } from '../types'

interface Props {
  tab: Tab
  isActive: boolean
  tabIndex: number  // Index of this tab in openTabs array
}

interface Emits {
  (e: 'select', id: string): void
  (e: 'close', id: string): void
  (e: 'rename', id: string, name: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const tabsStore = useTabsStore()

const isEditing = ref(false)
const editingName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

// Context menu state
const showContextMenu = ref(false)
const contextMenuPosition = ref<[number, number]>([0, 0])

// Check if there are tabs to the right of this one
const hasTabsToRight = computed(() => {
  const openTabs = tabsStore.openTabs
  return props.tabIndex < openTabs.length - 1
})

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

function handleEnterKey(event: KeyboardEvent) {
  // Ignore Enter during IME composition (e.g., Chinese input)
  if (event.isComposing) return
  handleBlur()
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

// Context menu handlers
function handleContextMenu(e: MouseEvent) {
  contextMenuPosition.value = [e.clientX, e.clientY]
  showContextMenu.value = true
}

function handleCloseOthers() {
  tabsStore.closeOtherTabs(props.tab.id)
}

function handleCloseToRight() {
  tabsStore.closeTabsToRight(props.tab.id)
}

function handleCloseAll() {
  tabsStore.closeAllTabs()
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
    box-shadow: 3px -1px 4px rgba(0,0,0,0.15);

    // Dark mode specific enhancement for better separation
    .v-theme--dark & {
      box-shadow: 3px -1px 6px rgba(0,0,0,0.6), inset 1px 1px 0 0 rgba(255, 255, 255, 0.08);
      background: #1e293b; // Slightly lighter than base (Slate-800) to pop against #020617 header
    }

    // Hide separator for active
    &::after {
      display: none;
    }
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

// Context menu styling
.tab-context-menu {
  min-width: 160px;
  
  :deep(.v-list-item) {
    min-height: 32px;
    font-size: 0.8rem;
    
    .v-list-item__prepend {
      .v-icon {
        font-size: 16px;
      }
    }
    
    .v-list-item-title {
      font-size: 0.8rem;
    }
  }
}
</style>
