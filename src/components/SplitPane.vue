<template>
  <div class="split-pane" :class="{ 'is-vertical': isVertical }">
    <div
      class="split-pane-left"
      :style="{ [sizeProperty]: leftSize + '%' }"
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
      :style="{ [sizeProperty]: rightSize + '%' }"
    >
      <slot name="right"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Props {
  initialRatio?: number // 預設分割比例，default 0.35
  minRatio?: number // 最小比例限制
  maxRatio?: number // 最大比例限制
}

const props = withDefaults(defineProps<Props>(), {
  initialRatio: 0.35,
  minRatio: 0.2,
  maxRatio: 0.8
})

const leftSize = ref(props.initialRatio * 100)
const isDragging = ref(false)
const isVertical = ref(false) // 預設為水平分割（左右）

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

// RWD: 小螢幕時切換為上下佈局
// 斷點：手機 < 600px, 平板 600-1024px, 桌面 > 1024px
const checkViewport = () => {
  isVertical.value = window.innerWidth < 768
  // 手機版面：強制上下佈局，並調整預設比例
  if (window.innerWidth < 600) {
    leftSize.value = 50 // 手機時各佔 50%
  } else if (window.innerWidth < 768) {
    leftSize.value = 40 // 平板時左側稍小
  } else if (leftSize.value === 50) {
    // 從手機切換回桌面時，恢復預設比例
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

.split-pane-left,
.split-pane-right {
  overflow: hidden;
  position: relative;
}

.split-pane-divider {
  position: relative;
  background-color: rgba(var(--v-theme-on-surface), 0.12);
  cursor: col-resize;
  user-select: none;
  flex-shrink: 0;
  width: 4px;
  transition: background-color 0.2s;

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

  .divider-handle {
    width: 40px;
    height: 20px;
  }
}
</style>
