<template>
  <div class="split-pane" :class="{ 'is-vertical': isVertical, 'is-collapsed': collapsed }">
    <div
      class="split-pane-left"
      :style="{ [sizeProperty]: (collapsed ? 0 : leftSize) + '%' }"
    >
      <slot name="left"></slot>
    </div>
    <div
      class="split-pane-divider"
      @mousedown="startDrag"
      :class="{ 'is-dragging': isDragging }"
    >
      <div class="divider-line"></div>
    </div>
    <div
      class="split-pane-right"
      :style="{ [sizeProperty]: (collapsed ? 100 : rightSize) + '%' }"
    >
      <slot name="right"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

interface Props {
  initialRatio?: number // Default split ratio, default 0.35
  minRatio?: number // Minimum ratio limit
  maxRatio?: number // Maximum ratio limit
  collapsed?: boolean // Whether the left side is collapsed
}

const props = withDefaults(defineProps<Props>(), {
  initialRatio: 0.35,
  minRatio: 0.1,
  maxRatio: 0.9,
  collapsed: false
})

const leftSize = ref(props.initialRatio * 100)
const isDragging = ref(false)
const isVertical = ref(false) // Default is horizontal split (side-by-side)

const sizeProperty = computed(() => (isVertical.value ? 'height' : 'width'))
const rightSize = computed(() => 100 - leftSize.value)

const startDrag = (e: MouseEvent) => {
  isDragging.value = true
  document.body.style.cursor = isVertical.value ? 'row-resize' : 'col-resize'
  document.body.style.userSelect = 'none' // Prevent text selection while dragging
  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

const handleDrag = (e: MouseEvent) => {
  if (!isDragging.value) return

  const container = (e.target as HTMLElement)?.closest('.split-pane')
  if (!container && !isDragging.value) return // Safety check

  // We need to calculate based on the window or a fixed container if the target is lost
  // But usually mousemove on document handles it.
  
  // Get container rect from a stable reference if possible, or query selector
  const splitPane = document.querySelector('.split-pane')
  if (!splitPane) return
  
  const rect = splitPane.getBoundingClientRect()
  const totalSize = isVertical.value ? rect.height : rect.width
  const mousePos = isVertical.value ? e.clientY - rect.top : e.clientX - rect.left
  const ratio = Math.max(props.minRatio, Math.min(props.maxRatio, mousePos / totalSize))

  leftSize.value = ratio * 100
}

const stopDrag = () => {
  isDragging.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// RWD: Switch to vertical layout on small screens
const checkViewport = () => {
  isVertical.value = window.innerWidth < 768
  if (window.innerWidth < 600) {
    leftSize.value = 50
  } else if (window.innerWidth < 768) {
    leftSize.value = 40
  } else if (leftSize.value === 50) {
    leftSize.value = props.initialRatio * 100
  }
}

onMounted(() => {
  checkViewport()
  window.addEventListener('resize', checkViewport)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkViewport)
  stopDrag()
})
</script>

<style scoped lang="scss">
.split-pane {
  display: flex;
  width: 100%;
  height: 100%;
  position: relative;

  &.is-vertical {
    flex-direction: column;
  }
}

.split-pane-left {
  overflow: hidden;
  position: relative;
  transition: width 0.1s linear, height 0.1s linear, opacity 0.2s;
  // Disable transition during drag for smoothness
  .is-dragging & {
    transition: none;
  }

  .is-collapsed & {
    opacity: 0;
    pointer-events: none;
  }
}

.split-pane-right {
  overflow: hidden;
  position: relative;
  transition: width 0.1s linear, height 0.1s linear;
  // Disable transition during drag for smoothness
  .is-dragging & {
    transition: none;
  }
}

.split-pane-divider {
  position: relative;
  background-color: transparent;
  flex-shrink: 0;
  z-index: 10;
  transition: all 0.2s;

  // Horizontal Split (default)
  width: 12px; // Hit area
  margin: 0 -6px; // Center overlap
  cursor: col-resize;
  
  display: flex;
  justify-content: center;
  align-items: center;

  .is-collapsed & {
    width: 0 !important;
    margin: 0 !important;
    opacity: 0;
    pointer-events: none;
  }
  
  // The visible line
  .divider-line {
    width: 1px;
    height: 100%;
    background-color: var(--border-color);
    transition: background-color 0.2s, width 0.2s;
  }

  &:hover .divider-line,
  &.is-dragging .divider-line {
    background-color: var(--primary-color);
    width: 2px;
  }
}

// Vertical Split
.split-pane.is-vertical .split-pane-divider {
  cursor: row-resize;
  width: 100%;
  height: 12px; // Hit area
  margin: -6px 0; // Center overlap
  
  .is-collapsed & {
    height: 0 !important;
    margin: 0 !important;
  }

  .divider-line {
    width: 100%;
    height: 1px;
  }
  
  &:hover .divider-line,
  &.is-dragging .divider-line {
    height: 2px;
    width: 100%;
  }
}
</style>
