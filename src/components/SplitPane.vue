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
      <div class="divider-handle"></div>
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
  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

const handleDrag = (e: MouseEvent) => {
  if (!isDragging.value) return

  const container = (e.target as HTMLElement)?.closest('.split-pane')
  if (!container) return

  const rect = container.getBoundingClientRect()
  const totalSize = isVertical.value ? rect.height : rect.width
  const mousePos = isVertical.value ? e.clientY - rect.top : e.clientX - rect.left
  const ratio = Math.max(props.minRatio, Math.min(props.maxRatio, mousePos / totalSize))

  leftSize.value = ratio * 100
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// RWD: Switch to vertical layout on small screens
// Breakpoints: Mobile < 600px, Tablet 600-1024px, Desktop > 1024px
const checkViewport = () => {
  isVertical.value = window.innerWidth < 768
  // Mobile layout: Force vertical layout and adjust default ratio
  if (window.innerWidth < 600) {
    leftSize.value = 50 // 50/50 split on mobile
  } else if (window.innerWidth < 768) {
    leftSize.value = 40 // Smaller left part on tablet
  } else if (leftSize.value === 50) {
    // Restore default ratio when switching back from mobile to desktop
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
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s;

  .is-collapsed & {
    opacity: 0;
    pointer-events: none;
  }
}

.split-pane-right {
  overflow: hidden;
  position: relative;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.split-pane-divider {
  position: relative;
  background-color: rgba(var(--v-theme-on-surface), 0.12);
  cursor: col-resize;
  user-select: none;
  flex-shrink: 0;
  width: 4px;
  transition: background-color 0.2s, width 0.3s, opacity 0.3s;

  .is-collapsed & {
    width: 0 !important;
    opacity: 0;
    pointer-events: none;
  }

  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.5);
  }

  &.is-dragging {
    background-color: rgba(var(--v-theme-primary), 0.8);
  }

  .divider-handle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 40px;
    border-radius: 4px;
    background-color: rgba(var(--v-theme-on-surface), 0.3);
    pointer-events: none;
  }
}

.split-pane.is-vertical .split-pane-divider {
  cursor: row-resize;
  width: 100%;
  height: 4px;

  .is-collapsed & {
    height: 0 !important;
    width: 100% !important;
  }

  .divider-handle {
    width: 40px;
    height: 20px;
  }
}
</style>
